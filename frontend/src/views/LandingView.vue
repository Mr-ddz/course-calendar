<template>
  <div class="landing-page">
    <!-- 导航栏 -->
    <header class="lp-header">
      <div class="lp-header-inner">
        <div class="lp-logo">
          <img src="../assets/images/logo.svg" class="lp-logo-icon" alt="课表侠" />
          <span class="lp-logo-text">课表侠</span>
        </div>
        <div class="lp-nav">
          <a href="#features">功能介绍</a>
          <a href="#about">关于</a>
          <el-button size="small" @click="goLogin" type="primary" round>进入应用</el-button>
        </div>
      </div>
    </header>

    <!-- Hero -->
    <section class="lp-hero">
      <div class="lp-hero-bg"></div>
      <div class="lp-hero-content">
        <div class="lp-hero-text">
          <h1 class="lp-hero-title">让排课 <span class="gradient-text">更简单</span></h1>
          <p class="lp-hero-desc">课表侠是一款专为教师和培训机构设计的课程管理工具。<br>排课、签到、课时费统计，一应俱全。</p>
          <div class="lp-hero-actions">
            <el-button type="primary" size="large" round @click="goLogin">免费开始使用</el-button>
            <el-button size="large" round @click="scrollToFeatures">了解更多</el-button>
          </div>
        </div>
        <div class="lp-hero-image">
          <div class="lp-mockup">
            <div class="mockup-header">📅 7月课程安排</div>
            <div class="mockup-body">
              <div class="mockup-row"><span>周一</span><span class="mockup-tag">张... 09:00</span></div>
              <div class="mockup-row"><span>周三</span><span class="mockup-tag">李... 09:30</span></div>
              <div class="mockup-row"><span>周五</span><span class="mockup-tag">王... 14:00</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 功能介绍 -->
    <section id="features" class="lp-features">
      <h2 class="section-title">核心功能</h2>
      <p class="section-desc">专为教师和培训机构设计，解决排课管理的一切烦恼</p>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">📅</div>
          <h3>月历视图</h3>
          <p>按月份查看所有课程安排，一目了然。支持快速跳转到任意日期。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">⏰</div>
          <h3>课程时间轴</h3>
          <p>06:00到23:00的分钟级时间轴，精确管理每节课的起止时间。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔄</div>
          <h3>每周重复</h3>
          <p>固定课程一键设置每周重复，自动生成未来一年的课程安排。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">✅</div>
          <h3>签到管理</h3>
          <p>记录每节课的学生到课情况，签到数据自动关联课时费统计。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <h3>数据统计</h3>
          <p>按周/月/年统计上课时长、应收费用和实收费用，自动汇总。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔒</div>
          <h3>数据隔离</h3>
          <p>多教师账号独立管理，每位老师只能看到自己的课程数据。</p>
        </div>
      </div>
    </section>

    <!-- 关于 -->
    <section id="about" class="lp-about">
      <h2 class="section-title">关于课表侠</h2>
      <p class="section-desc">一款轻量级的教师课程管理工具</p>
      <div class="about-content">
        <div class="about-text">
          <p>课表侠诞生于一线教师的实际需求，旨在解决中小型培训机构排课混乱、统计困难的问题。</p>
          <p>无需复杂配置，即开即用。支持多教师、多学生、多课程类型，让您专注于教学本身。</p>
        </div>
        <div class="about-stats">
          <div class="stat-item">
            <span class="stat-number">10+</span>
            <span class="stat-label">功能模块</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">7×24</span>
            <span class="stat-label">稳定运行</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">即刻</span>
            <span class="stat-label">免费使用</span>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="lp-cta">
      <h2>准备好开始了吗？</h2>
      <p>立即免费使用，体验高效排课的乐趣</p>
      <el-button type="primary" size="large" round @click="goLogin">进入课表侠</el-button>
    </section>

    <!-- 页脚 -->
    <footer class="lp-footer">
      <p>&copy; 2026 课表侠. All rights reserved.</p>
      <p style="margin-top: 4px; font-size: 11px;">
        <a href="https://beian.miit.gov.cn/" target="_blank" style="color: #bbb; text-decoration: none;">辽ICP备2026015173号-1</a>
      </p>
    </footer>

  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function goLogin() {
  router.push('/login')
}

function scrollToFeatures() {
  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<style scoped>
@import "../assets/css/landing.css";
</style>
