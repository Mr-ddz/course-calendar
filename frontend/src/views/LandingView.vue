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
          <a href="#howto">使用流程</a>
          <a href="#faq">常见问题</a>
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
          <p>按月份查看所有课程安排，支持按教师筛选。点击日期快速跳转到日详情页。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">⏰</div>
          <h3>课程时间轴</h3>
          <p>06:00到23:00的分钟级时间轴，精确管理每节课的起止时间，支持多教师分列显示。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔄</div>
          <h3>灵活重复</h3>
          <p>支持每周同一天重复和每周工作日重复，自动跳过法定节假日。可设置截止日期。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">👤</div>
          <h3>学生管理</h3>
          <p>学生信息集中管理，支持姓名/年级/课时单价编辑，已上课时自动统计。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">💰</div>
          <h3>预交课时费</h3>
          <p>签到自动扣费，余额不足标记待补交，充值后自动补扣。线上线下混合结算。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">✅</div>
          <h3>签到管理</h3>
          <p>记录每节课的学生到课情况，签到关联自动扣费，取消签到自动退款。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <h3>数据统计</h3>
          <p>按周/月/年统计上课时长、应收费用、实收费用，支持按教师筛选。一键导出CSV。</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔒</div>
          <h3>多级权限</h3>
          <p>超级管理员/机构管理员/教师三级权限体系，数据严格隔离，管理更灵活。</p>
        </div>
      </div>
    </section>

    <!-- 三步上手 -->
    <section id="howto" class="lp-howto">
      <h2 class="section-title">🚀 三步上手</h2>
      <p class="section-desc">注册账号、添加学生、开始排课，三步即可完成</p>
      <div class="howto-grid">
        <div class="howto-card">
          <div class="howto-step">1</div>
          <div class="howto-icon">👤</div>
          <h3>注册账号</h3>
          <p>免费注册教师账号，或由管理员后台创建，即刻开始使用。</p>
        </div>
        <div class="howto-arrow">→</div>
        <div class="howto-card">
          <div class="howto-step">2</div>
          <div class="howto-icon">📋</div>
          <h3>添加学生</h3>
          <p>录入学生信息，设置课时单价和缴费模式，统一管理。</p>
        </div>
        <div class="howto-arrow">→</div>
        <div class="howto-card">
          <div class="howto-step">3</div>
          <div class="howto-icon">📅</div>
          <h3>开始排课</h3>
          <p>创建课程安排，设置重复规则，签到自动关联扣费。</p>
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
          <p>支持多教师协作、预交课时费管理、学生信息管理、智能排课、签到扣费联动，让您专注于教学本身。</p>
        </div>
        <div class="about-stats">
          <div class="stat-item">
            <span class="stat-number">20+</span>
            <span class="stat-label">功能模块</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">7×24</span>
            <span class="stat-label">稳定运行</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">免费</span>
            <span class="stat-label">持续使用</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 常见问题 -->
    <section id="faq" class="lp-faq">
      <h2 class="section-title">🙋 常见问题</h2>
      <p class="section-desc">关于课表侠，您可能想了解这些</p>
      <div class="faq-list">
        <el-collapse accordion>
          <el-collapse-item title="课表侠收费吗？" name="1">
            <div class="faq-answer">完全免费。所有核心功能（排课、签到、统计、学生管理、预交课时费）均可免费使用，无需付费。</div>
          </el-collapse-item>
          <el-collapse-item title="如何创建教师账号？" name="2">
            <div class="faq-answer">两种方式：① 在登录页点击「免费注册」，填写信息后等待管理员审核通过；② 联系您的管理员，直接在后台为您创建账号。创建后您会收到包含登录信息的邮件通知。</div>
          </el-collapse-item>
          <el-collapse-item title="什么是预交课时费？" name="3">
            <div class="faq-answer">家长可以一次性充值一笔费用，每次学生签到上课时，系统自动从余额中扣除对应课时费。余额不足时会标记待补交，充值后自动补扣。也支持传统的课后结算模式，两种模式可随时切换。</div>
          </el-collapse-item>
          <el-collapse-item title="我之前的课程数据会不会丢失？" name="4">
            <div class="faq-answer">不会。所有数据存储在您的服务器上，系统升级不会影响已有数据。数据库文件独立保存，部署更新时不会被覆盖。建议定期备份数据库文件。</div>
          </el-collapse-item>
          <el-collapse-item title="忘记密码怎么办？" name="5">
            <div class="faq-answer">在登录页点击「忘记密码」，输入注册时填写的邮箱，系统会发送密码重置链接。如果注册时没有绑定邮箱，请联系管理员在后台重置密码。</div>
          </el-collapse-item>
          <el-collapse-item title="可以导出统计数据吗？" name="6">
            <div class="faq-answer">可以。在统计页面搜索课程后，点击「📥 导出CSV」按钮，即可将当前筛选结果导出为 CSV 文件，可用 Excel 或 WPS 打开查看。</div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </section>

    <!-- CTA -->
    <section class="lp-cta">
      <h2>准备好开始了吗？</h2>
      <p>立即免费使用，体验高效排课的乐趣</p>
      <el-button type="primary" size="large" round @click="goLogin">进入课表侠</el-button>
    </section>

    <!-- 使用反馈 -->
    <section class="lp-feedback">
      <h2>📧 使用反馈</h2>
      <p>有任何建议或问题？我们很乐意听取您的意见</p>
      <a href="mailto:kebiaoxia@126.com" class="feedback-btn">发送邮件反馈</a>
    </section>

    <!-- 页脚 -->
    <footer class="lp-footer">
      <p><a href="https://beian.miit.gov.cn/" target="_blank" style="color: #bbb; text-decoration: none;">辽ICP备2026015173号-1</a></p>
      <p style="margin-top: 4px; font-size: 11px; color: #bbb;">&copy; 2026 课表侠. All rights reserved.</p>
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
