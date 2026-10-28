# Lily 的生日雪夜 · 2026.10.29

[打开生日世界](https://young-t-source.github.io/Lily-birthday-gifts/)

为 Lily 的 21 岁准备的动态生日邀请、可以漫步的双层雪夜木屋和相片回忆。

开场流畅度更新：照片邀请停留期间，3D场景在完成材质预热后静止等待。点击Yes并淡出邀请后才启动世界帧循环；照片使用单层合成运动与更圆滑的椭圆轨迹，减少动态光晕、阴影和重复浮动的开销。专项检查为 `node project/check-invitation-performance-v10.cjs`。

## 这一版

- 开场用 10 张真实照片旋绕展示；点击 **Yes** 后进入，页面不会自动跳过邀请。
- 28 张照片按 7 个回忆章节编排，全部挂在二楼墙上。轻点相框可打开完整照片、故事说明和可翻页相册。
- 天空精选 8 张照片分 4 组浮现，首轮齐发烟花保留净空；47.5 秒前照片全部淡出，之后自然进入流星许愿。
- 公开入口是含蓄的“生日小笺”；回忆地图最后一章只留线索。沿木屋左前方的暖灯，找到“属于你的那棵树”，亲手打开树根旁的宝箱后，才能读到藏起来的那封信。

## 操作

电脑用 `W / A / S / D` 或方向键移动，拖动画面环视，`E` 互动，`Shift` 加快。手机用左下方向键移动，拖动环视。建议手机横屏体验 3D；相册支持竖屏。

“小屋里的心意”可前往二楼照片墙或直接翻看相册。相册支持上一张、下一张、方向键、缩略图及章节导航。`Esc` 或关闭按钮回到漫步。阅读时天空表演暂停，合上后继续；手动暂停会保留。

## 素材与时间线

`assets/album/photo-01.jpg` 至 `photo-28.jpg` 按本次上传顺序命名；`thumb-01.jpg` 至 `thumb-28.jpg` 是对应缩略图。展示顺序、章节、文案及开场/天空精选由 `project/album-manifest.json` 管理，文件编号和展示顺序互相独立。

照片使用完整画面和原始比例，已有马赛克保留。两张原本只有 275×207 的课堂小图保持原尺寸；打开相册也不会伪造高清细节。网页照片长边最高 1400 像素，缩略图最高 480 像素，避免原图拖慢加载。

背景音乐尚未添加，可放一首 `mp3 / ogg / wav / m4a` 到 `assets/music/` 后重新构建；当前有程序环境声。

## 构建和预览

安装 Node.js 后，在仓库根目录运行：

```sh
npm --prefix project install
npm --prefix project run build
npm --prefix project run check
npm --prefix project run preview
```

构建生成根目录 `index.html`，相片、模型、贴图均嵌入网页，无运行时 CDN 依赖。GitHub Pages 使用根目录入口；本地还会生成同内容的中文名称 HTML。

现行专项审计：`check-invitation-album-v9.cjs`、`check-album-ui-v9.cjs`、`check-gallery-v9.cjs`、`check-treasure-tree-v9.cjs`、`check-game-album-v9.cjs`。部分 CPU 几何与图片审计使用本机的 Canvas 运行环境；这些检查不代表手机真机性能测试。旧 v4–v8 专项脚本保留作历史版本检查。

原始图片备份、素材源路径报告和预览证据仅保存在本地，不发布。仓库和网页沿用原来的公开 GitHub Pages；页面 `noindex` 和 `robots.txt` 用于建议搜索引擎不要收录。

Three.js 0.160.0，MIT。基础木屋来自用户提供的“寒冬林居”。
