---
layout: post
title: 记一次服务器调优(goroutine和tcp连接)
categories: [技术]
published: true
tags: [golang,tcp]
date: 2019-12-19
---

## 起因
一次部署后,高峰时服务器报警.报警症状为,启动的Server(*golang*)虽然被重启过,但是缺无任何错误信息.同时重启后的Server在***发现服务***无信息,因此表示并没有成功注册.同时,虽然服务正常启动,但是Ping接口时总是出现TimeOut,导致无法正常使用,故排查之.

初略排查后最终确定为两方面:

* 其一: Server中的一个包,之前被同事修改,修改以后虽然Review过,发现了明显的严重Bug,不过当时因为忙着其他事就暂时没管了,这里不做说明( ~~然后这里还债~~ ).

* 其二: 其一中的问题里,将另一个一直存在但是缺没有暴露的问题给炸了出来,这里主要记录这个问题.


## 过程
当Server正常运行,且无法正常Ping时,其实第一反应已经确定是TCP链接数过多造成的,服务上一看,链接数直接超过**2W**,高峰时期甚至达到了**6W+**.同时内存也到极限.

已经大方向确认了问题,开始着手一步步处理,默认情况下,先对**Linun Server**进行调优,调优方式可参考备忘的[服务器优化](/2019-12/linux服务器配置优化),调整后数值有所降低,但是还是维持在一个不正常的高度,于是接下来就是代码方面的优化.

代码方面第一项基本上就考虑的是**goroutine**的优化,因为在一开始学习go语言时,就听过一些传言,golang成于**goroutine**,同时也败于**goroutine**.

---

## Goroutine
首先说说此Server的定位,Server接收到的每个API请求都需要最快的速度进行响应,同时请求者完全不需要关心Server内部是否成功.由于前后的数据处理还要同时和其他多个服务器配合,因此获取到请求后,将必要的参数获取出来然后放入**goroutine**中慢慢处理,将会是最优方案.

当业务量上升,并发数增加,Server中产生的**goroutine**数量也将不停增加,这就导致了内存暂用不断上升,而且服务器本身性能一般,当**goroutine**超过一定程度时,被炸无法避免.
>理论上讲,GO中每一个**goroutine**(**协程**)占用至少4K内存,一般情况下,一个Server中开启几万个基本不算什么事,但是在每个开启的**goroutine**中,可能会有Http(~~本Server~~)或者文件打开的操作,这些却是有着物理意义上面的各种限制,因此无节制的使用**goroutine**,可能会带来很多隐藏的问题.

为了控制**goroutine**数量,设置一个全局Pool是相对容易也是有效的管理方式,因此,为了调试,参考网络弄了个简易的:
```golang
//实现
package gopool

type Zero struct {}

type Pool struct {
  Worker chan func()
  MaxSize    chan Zero
}

func New(size int){
  reutrn  &Pool{
    Worker: make(chan func()),
    MaxSize: make(chan Zero, size)
  }
}

func (p *Pool) AddWoker(work func()){
  select {
    case p.Worker <- work:
    case p.MaxSize   <- Zero{}:
      go p.worker(work)
  }
}

func (p *Pool) worker(work func()) {
	defer func() { <-p.MaxSize }()
	for {
		work()
		work = <-p.Worker
	}
}

// 使用
pool := gopool.New(MaxSize)

pool.AddWork(func(){
  println("balabala")
  work("a","b")
})
```
通过**Channels**的特性实现的一个阻塞式Pool,虽然有不少其他问题,但一定程度上够简易,并且使用后确实对短时间的连接数疯狂增长起到了肉眼可见的控制作用.

---

## TCP

处理完爆炸性快速增长,但是缺依旧没办法解决TCP的逐步增长,高峰期时候,通过系统的自回收是完全达不到要求,因此,只能针对性的调试.

端口占用过多的,大部分是因为Server调用其他服务时出现了两种状态**TIME_WAIT**和**CLOSE_WAIT**,这两个状态基本都是处于TCP连接中,请求方和接受方在**长链接**的关闭过程中多次握手后产生的状态(~~详情自行百度或404~~)

然后问题来了,既然知道造成问题的原因,那么有什么办法可以立即解决呢?<br/>答案:短连接.<br/>因为上面两个状态从结论上来说基本都是因为长连接过程中没有立即释放端口导致,当然这个方案有个明显弊端,后面再提.

```golang
//将http设置为禁用长链接
transport := http.Transport{
	DisableKeepAlives: true,
}
	
htt := &http.Client{
  Transport: &transport,
}

htt.Get("...")
```

然后见证奇迹的时刻到了,短短几行调整,在部署至服务器上后,TCP的连接情况终于有了实质上的下降,从最高峰的几万TCP连接数,到现在同一时间段不超过半K的连接数.

理论上来讲,这样问题算解决了,服务器也能在高峰时很顺利的稳定运行,一切指标OK,但是仔细想想,还有些问题并没有真正解决:
* 短连接虽然解决了问题,但是每次重复建立连接的性能消耗其实还是挺高的,对于请求相对固定的服务器请求,明显还是长链接更优
* 既然是长连接,为何没有复用(Server调用的其他Server的IP地址固定,Golang的http库默认是启用长连接,但是每次调用时都重新开启了一个连接端口)

经过[https://granbluefantasy.jp](https://granbluefantasy.jp)查询后,终于找到了原因所在,不是别的~~就是自己菜~~

当了解了golang的http库后,一开始认为是请求响应后,没有正确关闭,然后返回一看,立即打脸
```golang
resp, err := http.Get(server)
//对接受到的内容处理后需要进行关闭操作,不进行关闭操作的话,连接将不会加入到连接缓存中
defer resp.Body.Close()
```

emmmmm,网上大部分也是到此为止,但是之前的事实证明,这个并不是正确的原因,然后翻看了下源码的说明:
> The http Client and Transport guarantee that Body is always
> non-nil, even on responses without a body or responses with
> a zero-length body. It is the caller's responsibility to
> close Body. The default HTTP client's Transport may not
> reuse HTTP/1.x "keep-alive" TCP connections if the Body is
> not read to completion and closed.

emmmmmmmmmmmmmmmmm,我英语很菜好不好,但是勉勉强强还是能基本读懂(感谢有道词典)<br />
反复读了几次后,突然好像知道了问题所在,大部分情况下,接受到请求后我们会读取全部body中数据,但是这个时候根据协议来说,真正的完成需要在结尾有一个长度为0的body.因此,虽然使用了`body.Close()`对本次请求进行关闭,可是因为没有接受到结束符,会导致本次关闭没有真正的正确进行;当新请求来时,由于前一次的请求端口没有正常关闭,所以只能新开一个端口进行请求,这也是明明为长连接,确没有复用的主要原因.因此添加一句后,便可一切正常:
```golang
// 直接将body设置为Nil状态
io.Copy(ioutil.Discard, r.resp.Body)
```

至此,问题解决,Server也从几万的连接数也下降到稳定150以内










