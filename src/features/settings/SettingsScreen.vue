<script setup lang="ts">
	import { computed } from 'vue'

	import AppHeader from '@/components/AppHeader.vue'
	import AppIcon from '@/components/AppIcon.vue'
	import {
		THEME_LABELS,
		type ThemePreference,
	} from '@/features/app-shell/model'
	import type { PerformanceDisplayMode } from '@/features/preferences/model'

	const props = defineProps<{
		themePreference : ThemePreference
		displayMode : PerformanceDisplayMode
	}>()

	const emit = defineEmits<{
		selectTheme : []
		plannedAction : [message: string]
		showAbout : []
		openCategories : []
		openTags : []
		selectDisplayMode : []
	}>()

	const themeLabel = computed(() => THEME_LABELS[props.themePreference])
	const displayModeLabel = computed(() => props.displayMode === 'poster' ? '海报' : '卡片')
</script>

<template>
	<view class="settings-screen">
		<AppHeader title="设置" />

		<scroll-view class="settings-content" scroll-y>
			<view class="settings-section">
				<text class="settings-section__title">外观</text>

				<button class="settings-row" aria-label="主题" hover-class="settings-row--pressed"
					@tap="$emit('selectTheme')">
					<view class="settings-row__icon">
						<AppIcon name="sun" />
					</view>
					<view class="settings-row__body">
						<text class="settings-row__label">主题</text>
					</view>
					<text class="settings-row__value">{{ themeLabel }}</text>
					<view class="settings-row__chevron">
						<AppIcon name="chevron" />
					</view>
				</button>
				<button class="settings-row" aria-label="颜色" hover-class="settings-row--pressed"
					@tap="$emit('plannedAction', '当前版本固定使用暖棕强调色')">
					<view class="settings-row__icon">
						<AppIcon name="droplet" />
					</view>
					<view class="settings-row__body">
						<text class="settings-row__label">颜色</text>
					</view>
					<view class="settings-row__swatch" aria-label="暖棕" />
					<view class="settings-row__chevron">
						<AppIcon name="chevron" />
					</view>
				</button>
				<button class="settings-row" aria-label="默认展示方式" hover-class="settings-row--pressed"
					@tap="$emit('selectDisplayMode')">
					<view class="settings-row__icon">
						<AppIcon name="grid" />
					</view>
					<view class="settings-row__body">
						<text class="settings-row__label">默认展示方式</text>
					</view>
					<text class="settings-row__value">{{ displayModeLabel }}</text>
					<view class="settings-row__chevron">
						<AppIcon name="chevron" />
					</view>
				</button>


			</view>

			<view class="settings-section">
				<text class="settings-section__title">记录管理</text>

				<button class="settings-row" aria-label="分类管理" hover-class="settings-row--pressed"
					@tap="$emit('openCategories')">
					<view class="settings-row__icon">
						<AppIcon name="folder" />
					</view>
					<view class="settings-row__body">
						<text class="settings-row__label">分类管理</text>
					</view>
					<view class="settings-row__chevron">
						<AppIcon name="chevron" />
					</view>
				</button>

				<button class="settings-row" aria-label="标签管理" hover-class="settings-row--pressed"
					@tap="$emit('openTags')">
					<view class="settings-row__icon">
						<AppIcon name="tag" />
					</view>
					<view class="settings-row__body">
						<text class="settings-row__label">标签管理</text>
					</view>
					<view class="settings-row__chevron">
						<AppIcon name="chevron" />
					</view>
				</button>

				<button class="settings-row settings-row--supporting" aria-label="本地备份与恢复"
					hover-class="settings-row--pressed" @tap="$emit('plannedAction', 'Android 本地备份将在 Milestone 5 开放')">
					<view class="settings-row__icon">
						<AppIcon name="backup" />
					</view>
					<view class="settings-row__body">
						<text class="settings-row__label">本地备份与恢复</text>
						<text class="settings-row__supporting">仅保存在当前 Android 设备或用户选择的位置</text>
					</view>
					<view class="settings-row__chevron">
						<AppIcon name="chevron" />
					</view>
				</button>
			</view>

			<view class="settings-section">
				<text class="settings-section__title">关于</text>

				<button class="settings-row" aria-label="关于记录现场" hover-class="settings-row--pressed"
					@tap="$emit('showAbout')">
					<view class="settings-row__icon">
						<AppIcon name="info" />
					</view>
					<view class="settings-row__body">
						<text class="settings-row__label">关于记录现场</text>
					</view>
					<view class="settings-row__chevron">
						<AppIcon name="chevron" />
					</view>
				</button>

				<view class="settings-row settings-row--static">
					<view class="settings-row__icon">
						<AppIcon name="award" />
					</view>
					<view class="settings-row__body">
						<text class="settings-row__label settings-row__label--muted">版本 0.1.0</text>
					</view>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<style scoped>
	.settings-screen {
		min-height: 100vh;
		background: var(--color-background);
	}

	.settings-content {
		box-sizing: border-box;
		height: calc(100vh - var(--app-header-height) - env(safe-area-inset-bottom));
		padding-bottom: calc(156rpx + env(safe-area-inset-bottom));
	}

	.settings-section {
		padding-top: 54rpx;
		border-bottom: var(--app-border-width) solid var(--color-border);
	}

	.settings-section__title {
		display: block;
		padding: 0 34rpx 22rpx;
		color: var(--color-accent);
		font-size: 29rpx;
		font-weight: 600;
		line-height: 1.3;
	}

	.settings-row {
		box-sizing: border-box;
		display: flex;
		width: 100%;
		min-height: 112rpx;
		margin: 0;
		padding: 0 30rpx 0 38rpx;
		align-items: center;
		gap: 24rpx;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--color-text);
		text-align: left;
		transition: background-color 140ms ease;
	}

	.settings-row::after {
		border: 0;
	}

	.settings-row--supporting {
		min-height: 142rpx;
	}

	.settings-row--pressed {
		background: var(--color-row-pressed);
	}

	.settings-row--static {
		color: var(--color-muted);
	}

	.settings-row__icon {
		width: 46rpx;
		height: 46rpx;
		flex: none;
		color: currentColor;
	}

	.settings-row__body {
		display: flex;
		min-width: 0;
		flex: 1;
		align-self: stretch;
		flex-direction: column;
		justify-content: center;
		gap: 5rpx;
		border-bottom: var(--app-border-width) solid var(--color-border-subtle);
	}

	.settings-row:last-child .settings-row__body {
		border-bottom: 0;
	}

	.settings-row__label {
		color: var(--color-text);
		font-size: 31rpx;
		font-weight: 500;
		line-height: 1.35;
	}

	.settings-row__label--muted,
	.settings-row__supporting,
	.settings-row__value {
		color: var(--color-muted);
	}

	.settings-row__supporting {
		max-width: 520rpx;
		font-size: 23rpx;
		line-height: 1.4;
	}

	.settings-row__value {
		flex: none;
		font-size: 27rpx;
		line-height: 1.3;
	}

	.settings-row__swatch {
		width: 42rpx;
		height: 42rpx;
		flex: none;
		border: var(--app-border-width) solid var(--color-accent-border);
		border-radius: 10rpx;
		background: var(--color-accent);
	}

	.settings-row__chevron {
		width: 32rpx;
		height: 32rpx;
		flex: none;
		color: var(--color-muted);
	}
</style>