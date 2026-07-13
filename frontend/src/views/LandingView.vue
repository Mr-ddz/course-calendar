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
.landing-page {
  min-height: 100vh;
  background: #fff;
  color: #333;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 导航栏 */
.lp-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #f0f0f0;
}
.lp-header-inner {
  max-width: 1080px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.lp-logo {
  display: flex;
  align-items: center;
  gap: 8px;
}
.lp-logo-icon {
  height: 28px;
  width: auto;
}
.lp-logo-text {
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.lp-nav {
  display: flex;
  align-items: center;
  gap: 24px;
}
.lp-nav a {
  text-decoration: none;
  color: #666;
  font-size: 14px;
  font-weight: 500;
  transition: color 0.2s;
}
.lp-nav a:hover { color: #667eea; }

/* Hero */
.lp-hero {
  position: relative;
  padding: 120px 24px 80px;
  overflow: hidden;
}
.lp-hero-bg {
  position: absolute;
  top: -50%;
  left: -50%;
  right: -50%;
  bottom: -50%;
  background: linear-gradient(135deg, #667eea05 0%, #764ba205 100%);
  border-radius: 50%;
  z-index: 0;
}
.lp-hero-content {
  max-width: 1080px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 60px;
}
.lp-hero-text { flex: 1; }
.lp-hero-title {
  font-size: 42px;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 16px;
  color: #1a1a2e;
}
.gradient-text {
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.lp-hero-desc {
  font-size: 16px;
  color: #666;
  line-height: 1.7;
  margin-bottom: 28px;
}
.lp-hero-actions { display: flex; gap: 12px; }
.lp-hero-image { flex: 1; display: flex; justify-content: center; }
.lp-mockup {
  width: 320px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(102,126,234,0.15);
  overflow: hidden;
  border: 1px solid #eef0f8;
}
.mockup-header {
  padding: 14px 18px;
  font-weight: 600;
  font-size: 14px;
  color: #1a1a2e;
  border-bottom: 1px solid #eef0f8;
  background: #fafbff;
}
.mockup-body { padding: 12px 18px; }
.mockup-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 13px;
  color: #666;
}
.mockup-row:last-child { border-bottom: none; }
.mockup-tag {
  font-size: 12px;
  background: #ecf5ff;
  color: #409eff;
  padding: 2px 10px;
  border-radius: 12px;
  font-weight: 500;
}

/* 通用 */
.section-title {
  text-align: center;
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 8px;
}
.section-desc {
  text-align: center;
  color: #999;
  font-size: 15px;
  margin-bottom: 48px;
}

/* 功能 */
.lp-features {
  max-width: 1080px;
  margin: 0 auto;
  padding: 80px 24px;
}
.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
.feature-card {
  background: #fafbff;
  border: 1px solid #eef0f8;
  border-radius: 16px;
  padding: 28px 24px;
  transition: transform 0.2s, box-shadow 0.2s;
}
.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(102,126,234,0.1);
}
.feature-icon { font-size: 32px; margin-bottom: 12px; }
.feature-card h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 8px;
}
.feature-card p {
  font-size: 13px;
  color: #888;
  line-height: 1.6;
}

/* 关于 */
.lp-about {
  max-width: 1080px;
  margin: 0 auto;
  padding: 80px 24px;
}
.about-content {
  display: flex;
  gap: 60px;
  align-items: center;
}
.about-text { flex: 1; }
.about-text p {
  font-size: 15px;
  color: #666;
  line-height: 1.8;
  margin-bottom: 12px;
}
.about-stats {
  display: flex;
  gap: 32px;
}
.stat-item {
  text-align: center;
}
.stat-number {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #667eea;
}
.stat-label {
  font-size: 13px;
  color: #999;
}

/* CTA */
.lp-cta {
  text-align: center;
  padding: 80px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}
.lp-cta h2 {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}
.lp-cta p {
  font-size: 15px;
  opacity: 0.85;
  margin-bottom: 24px;
}
.lp-cta .el-button--primary {
  --el-button-bg-color: #fff;
  --el-button-text-color: #667eea;
  --el-button-hover-bg-color: #f0f0ff;
}

/* 页脚 */
.lp-footer {
  text-align: center;
  padding: 24px;
  font-size: 12px;
  color: #bbb;
  background: #fafafa;
}

/* 响应式 */
@media (max-width: 768px) {
  .lp-hero-content { flex-direction: column; }
  .lp-hero-title { font-size: 30px; }
  .features-grid { grid-template-columns: repeat(2, 1fr); }
  .about-content { flex-direction: column; }
  .lp-nav a { display: none; }
}
@media (max-width: 480px) {
  .features-grid { grid-template-columns: 1fr; }
  .about-stats { flex-direction: column; gap: 16px; }
}
</style>
