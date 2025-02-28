<script setup>
import DefaultTheme from 'vitepress/theme';
</script>

<template>
  <DefaultTheme.Layout>
    <template #home-hero-image>
      <a href="./examples.html#ai-powered-analytics">
        <video
          autoplay
          loop
          muted
          src="/media/examples/ai-example-light.mp4"
          class="video light"
        />
        <video
          autoplay
          loop
          muted
          src="/media/examples/ai-example-dark.mp4"
          class="video dark"
        />
      </a>
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

@media (min-width: 640px) {
  .video {
    max-height: 256px;
  }
}

@media (min-width: 960px) {
  .video {
    max-height: 400px;
  }
}
</style>
