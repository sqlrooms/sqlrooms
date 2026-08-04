<script lang="ts">
let nextDiagramId = 0;
let renderQueue = Promise.resolve();

function queueRender(task: () => Promise<void>) {
  renderQueue = renderQueue.then(task, task);
  return renderQueue;
}
</script>

<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {useData} from 'vitepress';

const props = defineProps<{
  encoded: string;
}>();

const container = ref<HTMLElement>();
const error = ref<string>();
const source = decodeURIComponent(props.encoded);
const {isDark} = useData();

let renderVersion = 0;

async function renderDiagram() {
  const version = ++renderVersion;
  error.value = undefined;

  await queueRender(async () => {
    const {default: mermaid} = await import('mermaid');
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark.value ? 'dark' : 'default',
    });

    const id = `sqlrooms-mermaid-${++nextDiagramId}`;
    const {svg, bindFunctions} = await mermaid.render(id, source);
    if (version !== renderVersion || !container.value) return;

    container.value.innerHTML = svg;
    bindFunctions?.(container.value);
  }).catch((renderError: unknown) => {
    if (version !== renderVersion) return;
    error.value =
      renderError instanceof Error
        ? renderError.message
        : 'Unable to render this Mermaid diagram.';
  });
}

onMounted(renderDiagram);
watch(isDark, renderDiagram);
onBeforeUnmount(() => {
  renderVersion += 1;
});
</script>

<template>
  <div class="mermaid-diagram">
    <div v-if="!error" ref="container" />
    <div v-else class="mermaid-diagram-error">
      <p>{{ error }}</p>
      <pre><code>{{ source }}</code></pre>
    </div>
  </div>
</template>
