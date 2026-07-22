<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  console.info('[RecordLive] app launched')
})
</script>

<style>
@import "./styles/chips.css";

page,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  background: #ffffff;
  color: #1b1715;
  font-family:
    "Noto Sans SC", "PingFang SC", "Microsoft YaHei", Roboto, sans-serif;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

view,
text,
button,
scroll-view {
  box-sizing: border-box;
}

button {
  font-family: inherit;
}
</style>
