<script setup>
import DefaultTheme from 'vitepress/theme';
import {ref, onMounted} from 'vue';
import {useData} from 'vitepress';
const {frontmatter} = useData();
import CaseStudiesCarousel from './CaseStudiesCarousel.vue';

const SHOW_BANNER = false; // Set to false to hide banner and margin everywhere

const BANNER_ID = 'sqlrooms-launch-2025';
const open = ref(true);
const currentYear = new Date().getFullYear();

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

// Case studies carousel moved to CaseStudiesCarousel.vue and reads data from frontmatter
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
        <CaseStudiesCarousel v-if="frontmatter.layout === 'home'" />
        <div class="sponsors-footer">
          <div class="sponsor-item">
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
                class="foursquare-logo"
              />
            </a>
          </div>
          <div class="sponsor-item horizontal">
            Deploys by
            <a
              href="https://www.netlify.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="https://www.netlify.com/v3/img/components/netlify-light.svg"
                alt="Deploys by Netlify"
                class="netlify-logo netlify-light"
              />
              <img
                src="https://www.netlify.com/v3/img/components/netlify-dark.svg"
                alt="Deploys by Netlify"
                class="netlify-logo netlify-dark"
              />
            </a>
          </div>
        </div>
        <div class="copyright-row">
          Copyright © {{ currentYear }} SQLRooms contributors
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

html:not(.dark) .foursquare-logo {
  filter: invert(1);
}

html:not(.dark) .netlify-dark {
  display: none;
}

.dark .netlify-light {
  display: none;
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

.sponsors-footer {
  display: flex;
  flex-direction: row;
  gap: 3rem;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
  padding: 2rem 0;
  border-top: 1px solid var(--vp-c-divider);
  margin-top: 2rem;
}

.sponsor-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
}

.sponsor-item.horizontal {
  flex-direction: row;
  gap: 0.5rem;
  align-items: center;
}

.copyright-row {
  text-align: center;
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
  margin-top: 1rem;
  padding-bottom: 2rem;
}

.sponsors-footer a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-weight: 500;
}

.sponsors-footer a:hover {
  text-decoration: underline;
}

.netlify-logo {
  height: 32px;
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

/* Carousel styles moved to CaseStudiesCarousel.vue */
</style>
