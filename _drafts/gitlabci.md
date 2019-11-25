---
layout: post
title: gitlab-ci配置基本参数
categories: [gitlab,ci]
date: 2019-10-10
---

首先,直接上个模版(~~不一定能正确执行~~)
~~~yaml
# .gitlab-ci.yml
stages:
 - install
 - test
 - deploy

image: ruby:2.6.0

job1:
  stage: install
  script:
    - bundle install 

job2:
  stage: test
  service: 
    - mongo:4.1
  before_script:
   - bundle install
  script: bundle exec rails test:system

job3-1:
  stage: deploy
  before_script:
   - gem install mina --version 1.8.0
  script: 
   - mina deploy
   - mina restart

job3-2:
  stage: deploy
  only:
   - dev
  tags:
   - test
  before_script:
   - gem install mina --version 1.8.0
  script: 
   - mina test deploy
   - mina test restart
~~~


## 参数解释
### stages 阶段/流水线
定义整个ci/cd分为多少个阶段,以及阶段的执行顺序,在web的gitlab-ci中,也将多个阶段用图进行了分割,其中定义的阶段名也将为显示的阶段名(__可以直接使用中文__)
> 此处,阶段执行顺序为 install -> test -> deploy

### image 初始镜像
Job(后项)中使用的原始镜像,所有的脚本执行都会在此docker镜像中运行,当此项定义在config最外层时,对所有Job生效

### Job1、Job2、....  任务/作业
这里统称为Job, 一个Job为一个独立的完整执行脚本,里面包含了你需要在这一个脚本中需要做什么,其中需要至少包含一个__stage__(在哪个阶段执行)和一个__script__(做什么)