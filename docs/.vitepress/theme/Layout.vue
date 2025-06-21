<script setup>
import DefaultTheme from 'vitepress/theme';
</script>

<template>
  <DefaultTheme.Layout>
    <template #home-hero-image>
      <video
        autoplay
        loop
        muted
        src="/media/sqlrooms.mp4"
        class="video light"
        controls
      />
      <video
        autoplay
        loop
        muted
        src="/media/sqlrooms.mp4"
        class="video dark"
        controls
      />
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
</template>

<style scoped>
.video {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-height: 190px;
}

html:not(.dark) .video.dark {
  display: none;
}

.dark .video.light {
  display: none;
}

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

@media (min-width: 1500px) {
  .video {
    max-height: 400px;
  }
}
</style>
