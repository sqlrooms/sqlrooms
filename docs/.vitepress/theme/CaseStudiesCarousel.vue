<script setup>
import {ref} from 'vue';
import {useData} from 'vitepress';

const {frontmatter} = useData();

const currentSlide = ref(0);

function goTo(index) {
  const items = frontmatter.value?.caseStudies ?? [];
  const total = items.length;
  if (total === 0) return;
  currentSlide.value = ((index % total) + total) % total;
}

function next() {
  goTo(currentSlide.value + 1);
}

function prev() {
  goTo(currentSlide.value - 1);
}
</script>

<template>
  <div class="case-studies">
    <div class="cs-header">
      <h2>Case Studies</h2>
      <div class="cs-subtitle">Real-world applications built with SQLRooms</div>
    </div>

    <div class="cs-carousel" aria-roledescription="carousel">
      <button class="cs-nav cs-prev" @click="prev" aria-label="Previous">
        ‹
      </button>
      <div
        class="cs-viewport"
        role="group"
        :aria-label="`Slide ${currentSlide + 1} of ${(frontmatter.caseStudies ?? []).length}`"
      >
        <a
          v-for="(item, idx) in frontmatter.caseStudies ?? []"
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
      <button class="cs-nav cs-next" @click="next" aria-label="Next">›</button>
    </div>

    <div class="cs-dots" role="tablist" aria-label="Choose slide">
      <button
        v-for="(item, idx) in frontmatter.caseStudies ?? []"
        :key="`dot-${item.title}`"
        class="cs-dot"
        :class="{active: idx === currentSlide}"
        @click="goTo(idx)"
        :aria-selected="idx === currentSlide"
        :aria-label="`Show ${item.title}`"
      />
    </div>
  </div>
</template>

<style scoped>
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
  pointer-events: none;
  transform: scale(0.98);
  transition:
    opacity 250ms ease,
    transform 250ms ease;
  border-radius: 8px;
}
.cs-slide.active {
  pointer-events: all;
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
