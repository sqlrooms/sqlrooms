<script setup>
import DefaultTheme from 'vitepress/theme';
import {ref, onMounted} from 'vue';
import {useData} from 'vitepress';
const {frontmatter} = useData();

const SHOW_BANNER = false; // Set to false to hide banner and margin everywhere

const BANNER_ID = 'sqlrooms-launch-2025';
const open = ref(true);

onMounted(() => {
  if (localStorage.getItem(`sqlrooms-banner-${BANNER_ID}`) === 'true') {
    open.value = false;
    document.documentElement.classList.add('banner-dismissed');
  }
});

function dismiss() {
  open.value = false;
  document.documentElement.classList.add('banner-dismissed');
  localStorage.setItem(`sqlrooms-banner-${BANNER_ID}`, 'true');
}

// Carousel: case studies
const caseStudies = [
  {
    title: 'Foursquare Spatial Desktop',
    href: '/case-studies.html#foursquare-spatial-desktop',
    img: '/media/case-studies/fsq-spatial-desktop-earthquakes.webp',
    alt: 'Foursquare Spatial Desktop screenshot',
  },
  {
    title: 'Flowmap City',
    href: '/case-studies.html#flowmap-city',
    img: '/media/case-studies/flowmap-city.webp',
    alt: 'Flowmap City screenshot',
  },
  {
    title: 'Cosmograph',
    href: '/case-studies.html#cosmograph',
    img: '/media/case-studies/cosmograph.webp',
    alt: 'Cosmograph screenshot',
  },
];

const currentSlide = ref(0);
const isAutoPlay = ref(true);
let intervalId;

function goTo(index) {
  const total = caseStudies.length;
  currentSlide.value = ((index % total) + total) % total;
}

function next() {
  goTo(currentSlide.value + 1);
}

function prev() {
  goTo(currentSlide.value - 1);
}

onMounted(() => {
  const prefersReduced = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  if (!prefersReduced && isAutoPlay.value) {
    intervalId = window.setInterval(next, 5000);
  }
});
</script>

<template>
  <div
    :class="{
      'with-banner-margin':
        SHOW_BANNER && open && frontmatter.layout === 'home',
    }"
  >
    <div
      v-if="SHOW_BANNER && open && frontmatter.layout === 'home'"
      class="banner"
    >
      <span>🚀</span>
      <a
        href="https://medium.com/@foursquare/foursquare-introduces-sqlrooms-b6397d53546c"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>Read our launch announcement!</span>
      </a>
      <button @click="dismiss" aria-label="Close banner">&times;</button>
    </div>
    <DefaultTheme.Layout>
      <template #home-hero-image>
        <video
          class="video"
          poster="/media/overview/collage.webp"
          controls
          loop
          muted
        >
          <source src="/media/sqlrooms-examples-75.mp4" type="video/mp4" />
        </video>
        <!--
        <video
          class="video dark"
          src="/media/sqlrooms-examples.mp4"
          autoplay
          controls
          loop
          muted
        />-->
      </template>

      <template #layout-bottom>
        <div v-if="frontmatter.layout === 'home'" class="case-studies">
          <div class="cs-header">
            <h2>Case Studies</h2>
            <div class="cs-subtitle">
              Real-world applications built with SQLRooms
            </div>
          </div>
          <div class="cs-carousel" aria-roledescription="carousel">
            <button class="cs-nav cs-prev" @click="prev" aria-label="Previous">
              ‹
            </button>
            <div
              class="cs-viewport"
              role="group"
              :aria-label="`Slide ${currentSlide + 1} of ${caseStudies.length}`"
            >
              <a
                v-for="(item, idx) in caseStudies"
                :key="item.title"
                class="cs-slide"
                :class="{active: idx === currentSlide}"
                :href="item.href"
                :aria-hidden="idx !== currentSlide"
                tabindex="0"
              >
                <img
                  :src="item.img"
                  :alt="item.alt"
                  width="300"
                  height="200"
                  loading="lazy"
                />
                <span class="cs-title">{{ item.title }}</span>
              </a>
            </div>
            <button class="cs-nav cs-next" @click="next" aria-label="Next">
              ›
            </button>
          </div>

          <div class="cs-dots" role="tablist" aria-label="Choose slide">
            <button
              v-for="(item, idx) in caseStudies"
              :key="`dot-${item.title}`"
              class="cs-dot"
              :class="{active: idx === currentSlide}"
              @click="goTo(idx)"
              :aria-selected="idx === currentSlide"
              :aria-label="`Show ${item.title}`"
            />
          </div>
        </div>
        <div class="foursquare-footer">
          Supported by
          <a
            href="https://location.foursquare.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              width="100"
              height="32"
              src="/public/foursquare-logo.svg"
              alt="Foursquare Logo"
              decoding="async"
            />
          </a>
        </div>
      </template>
    </DefaultTheme.Layout>
  </div>
</template>

<style>
.with-banner-margin {
  --vt-banner-height: 38px;
}
.banner-dismissed .banner {
  display: none;
}

.with-banner-margin .VPNavBar,
.with-banner-margin .VPLocalNav,
.with-banner-margin .VPContent {
  margin-top: var(--vt-banner-height);
}
</style>

<style scoped>
.video {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-height: 190px;
}

/*
html:not(.dark) .video.dark {
  display: none;
}

.dark .video:not(.dark) {
  display: none;
}
*/

.foursquare-footer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
  padding: 2rem 0;
  border-top: 1px solid var(--vp-c-divider);
  margin-top: 2rem;
}

.foursquare-footer p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}

.foursquare-footer a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-weight: 500;
}

.foursquare-footer a:hover {
  text-decoration: underline;
}

html:not(.dark) .foursquare-footer img {
  filter: invert(1);
}

.video {
  max-height: 150px;
}

@media (min-width: 640px) {
  .video {
    max-height: 256px;
  }
}

@media (min-width: 1000px) {
  .video {
    max-height: 300px;
  }
}

.banner {
  position: fixed;
  z-index: 1000;
  box-sizing: border-box;
  top: 0;
  left: 0;
  right: 0;
  height: var(--vt-banner-height);
  line-height: var(--vt-banner-height);
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(90deg, #ac3979 0%, #21305a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.banner a {
  color: #fff;
  text-decoration: underline;
  font-weight: normal;
  margin-right: 1.5rem;
}
.banner button {
  position: absolute;
  right: 0.75rem;
  top: 0;
  bottom: 0;
  background: none;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
  padding: 0 0.5rem;
  transition: color 0.2s;
  display: flex;
  align-items: center;
}
.banner button:hover {
  color: #222;
}
@media (max-width: 720px) {
  .banner {
    font-size: 13px;
    padding-left: 0.5rem;
    padding-right: 2.5rem; /* leave space for close button */
    white-space: normal;
    word-break: break-word;
    flex-wrap: wrap;
    min-height: var(--vt-banner-height);
  }
  .banner span {
    display: inline;
    white-space: normal;
    word-break: break-word;
  }
}

/* Case Studies Carousel */
.case-studies {
  width: 100%;
  margin: 2rem 0;
  padding: 2rem;
  border-top: 1px solid var(--vp-c-divider);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.cs-header {
  width: 100%;
  font-weight: bold;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.4rem;
}
.cs-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--vp-c-text-1);
}
.cs-subtitle {
  font-size: 1rem;
  color: var(--vp-c-text-2);
  font-weight: normal;
  margin-top: 0.25rem;
  text-align: center;
}
.cs-view-all {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-size: 0.9rem;
}
.cs-view-all:hover {
  text-decoration: underline;
}

.cs-carousel {
  position: relative;
  width: 400px;
  max-width: 90%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.5rem;
}
.cs-viewport {
  position: relative;
  overflow: hidden;
  height: 300px;
}
.cs-slide {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(0.98);
  transition:
    opacity 250ms ease,
    transform 250ms ease;
  border-radius: 8px;
}
.cs-slide.active {
  opacity: 1;
  transform: scale(1);
}
.cs-slide img {
  border-radius: 8px;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.08);
  max-width: 100%;
  height: auto;
}
.cs-title {
  margin-top: 0.5rem;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}
.cs-nav {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  width: 32px;
  height: 32px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.cs-nav:hover {
  background: var(--vp-c-bg-mute);
}
.cs-prev {
  justify-self: start;
}
.cs-next {
  justify-self: end;
}

.cs-dots {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.cs-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  cursor: pointer;
}
.cs-dot.active {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

@media (max-width: 640px) {
  .cs-viewport {
    height: 220px;
  }
}
</style>
