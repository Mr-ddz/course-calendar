<template>
  <div class="landing-page">
    <!-- 导航栏 -->
    <header class="lp-header" :class="{ 'lp-header--scrolled': scrolled }">
      <div class="lp-header-inner">
        <div class="lp-logo">
          <img src="../assets/images/logo.svg" class="lp-logo-icon" alt="课表侠" />
          <span class="lp-logo-text">课表侠</span>
        </div>
        <nav class="lp-nav">
          <a href="#features">功能介绍</a>
          <a href="#howto">使用流程</a>
          <a href="#about">产品特色</a>
          <a href="#faq">常见问题</a>
          <el-button size="small" type="primary" round class="lp-nav-btn" @click="goLogin">进入应用</el-button>
        </nav>
      </div>
    </header>

    <!-- Hero -->
    <section class="lp-hero">
      <div class="lp-hero-bg">
        <div class="lp-blob lp-blob--1"></div>
        <div class="lp-blob lp-blob--2"></div>
        <div class="lp-blob lp-blob--3"></div>
        <div class="lp-grid-overlay"></div>
      </div>
      <div class="lp-hero-content">
        <div class="lp-hero-text">
          <div class="lp-badge" data-reveal>🎓 专为教师与培训机构打造</div>
          <h1 class="lp-hero-title" data-reveal>
            让排课 <span class="gradient-text">更简单</span><br />
            让课时费 <span class="gradient-text">更省心</span>
          </h1>
          <p class="lp-hero-desc" data-reveal>
            课表侠是一站式课程管理平台 —— 排课、签到、预交课时费自动扣款、统计导出，一应俱全。<br />
            告别 Excel 与手工记账，把时间还给教学本身。
          </p>
          <div class="lp-hero-actions" data-reveal>
            <el-button size="large" round class="lp-btn-primary" @click="goLogin">免费开始使用 →</el-button>
            <el-button size="large" round class="lp-btn-ghost" @click="scrollToFeatures">了解更多</el-button>
          </div>
          <div class="lp-trust" data-reveal>
            <span>✓ 数据私有部署</span>
            <span>✓ 三级权限隔离</span>
            <span>✓ 一键导出 Excel</span>
          </div>
        </div>
        <div class="lp-hero-image" data-reveal>
          <div class="lp-mockup">
            <div class="mockup-bar">
              <span class="mockup-dot mockup-dot--r"></span>
              <span class="mockup-dot mockup-dot--y"></span>
              <span class="mockup-dot mockup-dot--g"></span>
              <span class="mockup-bar-title">课表侠 · 课程月历</span>
            </div>
            <div class="mockup-week">
              <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
            </div>
            <div class="mockup-grid">
              <div
                v-for="cell in mockCells"
                :key="cell.n"
                class="mock-cell"
                :class="cell.cls"
              >
                <span class="mock-cell-n">{{ cell.n }}</span>
                <span v-if="cell.label" class="mock-cell-pill" :class="cell.pill">{{ cell.label }}</span>
              </div>
            </div>
          </div>
          <div class="lp-float-card lp-float-card--1">
            <span class="fc-ic">💰</span>
            <div class="fc-body">
              <b>+¥3,280</b>
              <span>本月课时费已入账</span>
            </div>
          </div>
          <div class="lp-float-card lp-float-card--2">
            <span class="fc-ic">✅</span>
            <div class="fc-body">
              <b>签到自动扣费</b>
              <span>余额充足 · 无需操心</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 功能介绍 -->
    <section id="features" class="lp-features">
      <h2 class="section-title" data-reveal>核心功能</h2>
      <p class="section-desc" data-reveal>专为教师和培训机构设计，解决排课管理的一切烦恼</p>
      <div class="features-grid">
        <div
          v-for="(f, i) in features"
          :key="f.title"
          class="feature-card"
          data-reveal
          :style="{ '--i': i }"
        >
          <div class="feature-icon" :class="`feature-icon--${f.tone}`">{{ f.icon }}</div>
          <h3>{{ f.title }}</h3>
          <p>{{ f.desc }}</p>
        </div>
      </div>
    </section>

    <!-- 数据亮点 -->
    <section class="lp-stats">
      <div class="lp-stats-inner">
        <div class="stat-item" data-reveal>
          <span class="stat-number"><b data-count="20">0</b><span class="stat-suffix">+</span></span>
          <span class="stat-label">功能模块</span>
        </div>
        <div class="stat-item" data-reveal>
          <span class="stat-number"><b data-count="7">0</b><span class="stat-suffix">×24</span></span>
          <span class="stat-label">稳定运行</span>
        </div>
        <div class="stat-item" data-reveal>
          <span class="stat-number"><b data-count="100">0</b><span class="stat-suffix">%</span></span>
          <span class="stat-label">课时费自动核算</span>
        </div>
        <div class="stat-item" data-reveal>
          <span class="stat-number"><b data-count="3">0</b><span class="stat-suffix">级</span></span>
          <span class="stat-label">权限体系</span>
        </div>
      </div>
    </section>

    <!-- 三步上手 -->
    <section id="howto" class="lp-howto">
      <h2 class="section-title" data-reveal>三步上手</h2>
      <p class="section-desc" data-reveal>注册账号、添加学生、开始排课，三步即可完成</p>
      <div class="howto-grid">
        <template v-for="item in howtoSteps" :key="item.kind === 'arrow' ? 'arrow-' + item.id : item.id">
          <div v-if="item.kind === 'card'" class="howto-card" data-reveal :style="{ '--i': item.i }">
            <div class="howto-step">{{ item.step }}</div>
            <div class="howto-icon">{{ item.icon }}</div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.desc }}</p>
          </div>
          <span v-else class="howto-arrow">→</span>
        </template>
      </div>
    </section>

    <!-- 产品特色 -->
    <section id="about" class="lp-about">
      <h2 class="section-title" data-reveal>为什么选择课表侠</h2>
      <p class="section-desc" data-reveal>一款诞生于一线教师真实需求的产品</p>
      <div class="about-content">
        <div class="about-text" data-reveal>
          <p class="about-lead">课表侠源于一线教师和管理者的实际痛点，专注解决中小型培训机构<strong>排课混乱、课时费核算困难</strong>的问题。</p>
          <ul class="about-points">
            <li><span class="about-check">✓</span> 多教师协作，课程分列清晰，排课不再打架</li>
            <li><span class="about-check">✓</span> 预交课时费签到自动扣款，余额不足自动标记待补交</li>
            <li><span class="about-check">✓</span> 数据私有部署，课程与财务数据完全由您掌控</li>
          </ul>
        </div>
        <div class="about-card" data-reveal>
          <div class="about-card-icon">🛡️</div>
          <h3>安全 · 稳定 · 可掌控</h3>
          <p>所有数据存储于您自己的服务器，支持定期备份与迁移。超管 / 机构管理员 / 教师三级权限，数据严格隔离。</p>
          <div class="about-card-tags">
            <span>私有部署</span>
            <span>三级权限</span>
            <span>定期备份</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 常见问题 -->
    <section id="faq" class="lp-faq">
      <h2 class="section-title" data-reveal>常见问题</h2>
      <p class="section-desc" data-reveal>关于课表侠，您可能想了解这些</p>
      <div class="faq-list" data-reveal>
        <el-collapse accordion>
          <el-collapse-item title="如何创建教师账号？" name="1">
            <div class="faq-answer">两种方式：① 在登录页点击「注册」，填写信息后等待管理员审核通过；② 联系您的管理员，直接在后台为您创建账号。创建后您会收到包含登录信息的邮件通知。</div>
          </el-collapse-item>
          <el-collapse-item title="什么是预交课时费？" name="2">
            <div class="faq-answer">家长可以一次性充值一笔费用，每次学生签到上课时，系统自动从余额中扣除对应课时费。余额不足时会标记待补交，充值后自动补扣。也支持传统的课后结算模式，两种模式可随时切换。</div>
          </el-collapse-item>
          <el-collapse-item title="我之前的课程数据会不会丢失？" name="4">
            <div class="faq-answer">不会。所有数据存储在您的服务器上，系统升级不会影响已有数据。数据库文件独立保存，部署更新时不会被覆盖。建议定期备份数据库文件。</div>
          </el-collapse-item>
          <el-collapse-item title="忘记密码怎么办？" name="5">
            <div class="faq-answer">在登录页点击「忘记密码」，输入注册时填写的邮箱，系统会发送密码重置链接。如果注册时没有绑定邮箱，请联系管理员在后台重置密码。</div>
          </el-collapse-item>
          <el-collapse-item title="可以导出统计数据吗？" name="6">
            <div class="faq-answer">可以。在统计页面搜索课程后，点击「📥 导出Excel」按钮，即可将当前筛选结果导出为 Excel 文件。</div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </section>

    <!-- CTA -->
    <section class="lp-cta">
      <div class="lp-cta-orb lp-cta-orb--1"></div>
      <div class="lp-cta-orb lp-cta-orb--2"></div>
      <h2 data-reveal>准备好开始了吗？</h2>
      <p data-reveal>立即开始使用，体验高效排课的乐趣</p>
      <div data-reveal>
        <el-button size="large" round class="lp-cta-btn" @click="goLogin">进入课表侠 →</el-button>
      </div>
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
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

function goLogin() {
  router.push('/login')
}

function scrollToFeatures() {
  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
}

// 导航栏滚动态
const scrolled = ref(false)
function onScroll() {
  scrolled.value = window.scrollY > 16
}

// 滚动浮现观察器
let revealObserver = null
// 数字计数观察器
let countObserver = null

function animateCount(el) {
  const target = parseFloat(el.dataset.count) || 0
  const duration = 1200
  const start = performance.now()
  function tick(now) {
    const p = Math.min(1, (now - start) / duration)
    // easeOutCubic
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)))
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  revealObserver = new IntersectionObserver(
    entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          revealObserver.unobserve(e.target)
        }
      })
    },
    { threshold: 0.12 }
  )
  document.querySelectorAll('[data-reveal]').forEach(el => revealObserver.observe(el))

  countObserver = new IntersectionObserver(
    entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.querySelectorAll('[data-count]').forEach(animateCount)
          countObserver.unobserve(e.target)
        }
      })
    },
    { threshold: 0.4 }
  )
  const stats = document.querySelector('.lp-stats-inner')
  if (stats) countObserver.observe(stats)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  revealObserver?.disconnect()
  countObserver?.disconnect()
})

// 功能卡片
const features = [
  { icon: '📅', tone: 'indigo', title: '月历视图', desc: '按月份查看所有课程安排，支持按教师筛选。点击日期快速跳转到日详情页。' },
  { icon: '⏰', tone: 'violet', title: '课程时间轴', desc: '06:00 到 23:00 的分钟级时间轴，精确管理每节课的起止时间，支持多教师分列显示。' },
  { icon: '🔄', tone: 'cyan', title: '灵活重复', desc: '支持每周同一天重复和每周工作日重复，自动跳过法定节假日。可设置截止日期。' },
  { icon: '👤', tone: 'rose', title: '学生管理', desc: '学生信息集中管理，支持姓名/年级/课时单价编辑，已上课时自动统计。' },
  { icon: '💰', tone: 'amber', title: '预交课时费', desc: '签到自动扣费，余额不足标记待补交，充值后自动补扣。线上线下混合结算。' },
  { icon: '✅', tone: 'green', title: '签到管理', desc: '记录每节课的学生到课情况，签到关联自动扣费，取消签到自动退款。' },
  { icon: '📊', tone: 'indigo', title: '数据统计', desc: '按周/月/年统计上课时长、应收费用、实收费用，支持按教师筛选。一键导出Excel。' },
  { icon: '🔒', tone: 'violet', title: '多级权限', desc: '超级管理员/机构管理员/教师三级权限体系，数据严格隔离，管理更灵活。' }
]

// 三步上手（平铺结构，中间插入箭头）
const howtoSteps = [
  { kind: 'card', id: 'h1', i: 0, step: '1', icon: '👤', title: '注册账号', desc: '注册教师账号，或由管理员后台创建，即刻开始使用。' },
  { kind: 'arrow', id: 'a1' },
  { kind: 'card', id: 'h2', i: 1, step: '2', icon: '📋', title: '添加学生', desc: '录入学生信息，设置课时单价和缴费模式，统一管理。' },
  { kind: 'arrow', id: 'a2' },
  { kind: 'card', id: 'h3', i: 2, step: '3', icon: '📅', title: '开始排课', desc: '创建课程安排，设置重复规则，签到自动关联扣费。' }
]

// Hero 月历 Mockup 数据
const mockCells = []
const mockCourses = {
  2: ['语文', 'pill--indigo'],
  6: ['数学', 'pill--violet'],
  9: ['英语', 'pill--cyan'],
  14: ['语文', 'pill--indigo'],
  18: ['数学', 'pill--violet'],
  23: ['英语', 'pill--cyan'],
  27: ['物理', 'pill--rose']
}
for (let d = 1; d <= 28; d++) {
  const c = mockCourses[d]
  mockCells.push(c ? { n: d, label: c[0], pill: c[1], cls: 'mock-cell--has' } : { n: d })
}
</script>

<style scoped>
@import "../assets/css/landing.css";
</style>

<style>
/* 全站平滑滚动（仅供本页锚点导航） */
html {
  scroll-behavior: smooth;
}
</style>
