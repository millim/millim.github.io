---
layout: post
title: 记一次docker中的Elasticsearch小坑
categories: [技术]
published: true
tags: [gitlab,ci,docker]
date: 2019-10-13
id: 1070
---

__Elasticsearch__ 记作 __es__, 自从升级到7.x版本后,发现单个 __es__ 是无法正常启动的(因为默认要求配置集群啥的),但是这个不是问题!

  但是在gitlab-ci/cd中,这个居然就成为了一个问题,默认的情况下,service使用es时,理论上只要配置好即可:
~~~yaml
# 例子
service:
  elasticsearch:7.x
~~~
但是实际情况是,新版启动后将会提示失败,因为需要配置集群.好的,这个没问题,看看网上的处理方案,大部分是增加为ci增加一个变量信息:
~~~yaml
variables:
  "discovery.type": "single-node"
~~~
实际使用后发现并不是我的问题,同时这个配置让我的Job产生了新的错误 ~~不识别此条环境变量~~

经过多次搜索-》测试后,最终并能正确执行的方案变成了这样:
~~~yaml
service:
  - name: docker.elastic.co/elasticsearch/elasticsearch:7.x
    alias: elasticsearch
    command: [ "bin/elasticsearch", "-Ediscovery.type=single-node" ]
~~~
到这里为止,问题是解决了,但是却多了个很神奇的问题(至少我没有理解原因)
其中service的镜像从 __elasticsearch:7.x__ 变成了 __docker.elastic.co/elasticsearch/elasticsearch:7.x__,之所以要变更,是因为原始的 __elasticsearch:7.x__ 在执行 __command__ 中的 __bin/elasticsearch__ 时, **会提示已经启动过,切换成完整的过后,就能正常的启动**.

正常情况下,我惯性的认为两个镜像不同,但是!当我执行 `docker images`时,我发现这两个image的`IMAGE ID`居然是一模一样的!

有空时候再看看吧...谁叫自己是docker小白呢?


