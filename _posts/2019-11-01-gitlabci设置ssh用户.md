---
layout: post
title: gitlab-ci设置ssh-key
categories: [技术]
published: true
tags: [Gitlab]
date: 2019-11-01
id: 1071
---

#### 步骤:
* 登录gitlab-web页面,进入需要设置的项目中.
* 项目菜单选择 `设置` -》 `ci/cd` -》 `Variables`
* 设置作为登录用的密匙 `RSA_KEY`
* 对应的`ci`脚本中增加设置key脚本:

~~~yaml
script:
- eval $(ssh-agent -s) #确认ssh是否正常可用,不可用的话需要根据镜像进行安装
- mkdir ~/.ssh #创建ssh目录
- chmod 700 ~/.ssh #设置目录权限,重要
- echo "$PRV_KEY" > ~/.ssh/id_rsa  #将web设置的变量传入
- chmod 600 ~/.ssh/id_rsa   #设置文件权限,重要
# 下面两项和上面两项均为可选,主要是根据你需要去登录还是拉取
# - echo "$PRV_KEY.pub" > ~/.ssh/id_rsa   # 设置Pub
# - chmod 630 ~/.ssh/id_rsa   # 调整权限

#如果需要设置hosts,则有下面两种方式:
- echo "$SSH_KNOWN_HOSTS" > ~/.ssh/known_hosts
- chmod 644 ~/.ssh/known_hosts

# or

- ssh-keyscan example.com >> ~/.ssh/known_hosts
- chmod 644 ~/.ssh/known_hosts

# 如果设置了hosts,则额外来一句下面内容,来处理下Docker的一些问题
- '[[ -f /.dockerenv ]] && echo -e "Host *\n\tStrictHostKeyChecking no\n\n" > ~/.ssh/config'
~~~

[官方参考](https://docs.gitlab.com/ee/ci/ssh_keys/)