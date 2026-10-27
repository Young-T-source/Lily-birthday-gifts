# Lily's birthday world · 2026.10.29

[打开生日世界](https://young-t-source.github.io/Lily-birthday-gifts/)

本次版本沿用仓库原有的公开 GitHub Pages 链接，将早期页面更新为动态生日邀请和可以漫步的 3D 雪夜木屋。她用电脑浏览器打开链接即可观看，无需安装本地开发工具。

## 这一版

- 迎接 Lily 的 21 岁：16 扇照片窗格围绕邀请页缓慢旋转，搭配玫瑰色、香槟金和星光。
- 开场呼应她喜欢的“要变成光，因为有怕黑的人”，以及“10月29日，你要爱久”。
- 场景准备完成后，点击 **Yes** 才会进入童话世界；**no** 保持不可点击，页面不会自动进入。
- 木屋包含可以触摸的生日物件、回忆和祝福，以及自动衔接的烟花与流星许愿。

照片目前保留为空白光影窗格，没有使用冒充本人的图片。

## 在世界里漫步

建议使用较新的 Chrome 或 Edge。首次打开需要准备 3D 场景的材质。

- `W / A / S / D` 或方向键移动，拖动画面环视，`Shift` 加快。
- 靠近木门按 `E` 开关；靠近物件按 `E` 或点击触摸。
- “小屋里的心意”可以前往物件，“回忆地图”可以阅读章节。
- “为你点亮天空”播放烟花与流星，自动过渡、自动收尾；可以暂停和重放。
- `Esc` 可合上阅读、取消触摸或提前结束天空表演，平时返回观景。

## 后续加入照片与音乐

请使用有权分享的素材。这个仓库和 Pages 网页是公开的；`robots.txt` 和页面的 `noindex` 用于建议搜索引擎不要收录，不提供密码保护。

| 用途 | 文件夹 | 读取规则 |
| --- | --- | --- |
| 开场照片窗格 | `assets/invitation-photos/` | 按文件名排序，最多 16 张 |
| 3D 世界里的照片墙 | `assets/photos/` | 按文件名排序，前三张 |
| 背景音乐 | `assets/music/` | 一首音乐 |

照片支持 `jpg / jpeg / png / webp`，可以命名为 `01.jpg`、`02.jpg` 等；音乐支持 `mp3 / ogg / wav / m4a`。这两个照片目录互相独立，开场和照片墙可以选择不同的照片。

加入或替换素材后，重新构建，再提交并推送 `index.html`、素材和更新后的源码。构建会将素材嵌入网页，不需要访客额外下载项目。

## 从源码构建

安装 Node.js 后，在仓库根目录运行：

```sh
npm --prefix project install
npm --prefix project run build
```

构建会更新根目录的 `index.html`，同时生成一份不提交的中文名称本地入口。GitHub Pages 使用根目录的 `index.html`。

可以继续运行检查和本地预览：

```sh
npm --prefix project run check
node project/check-invitation-v8.cjs
npm --prefix project run preview
```

本地预览地址会显示在终端。浏览器里的场景、贴图和模型已经内嵌在发布 HTML 中，不依赖运行时 CDN。

## 文件

- `index.html`：可直接发布的完整网页。
- `project/src/`：Three.js 世界、邀请页、样式和交互源码。
- `project/assets/`：重新构建所需的两份 GLB 物件素材。
- `assets/`：后续自行加入的照片与音乐位置。
- `anime_girl.png`、`panda.png`：仓库早期版本保留的素材。
- `Three.js-LICENSE.txt`：Three.js 许可文本。

