<script setup>
import DefaultTheme from 'vitepress/theme';
import {ref, onMounted, watchEffect} from 'vue';
import {useData} from 'vitepress';
const {frontmatter} = useData();

const SHOW_BANNER = true; // Set to false to hide banner and margin everywhere

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
</style>
