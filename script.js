// 初始化mermaid配置
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark', // Apply dark theme to Mermaid diagrams
    securityLevel: 'loose',
    // Optional: Define a custom dark theme if needed
    // themeVariables: {
    //     darkMode: true,
    //     background: '#1a1a1a', // Match body background or choose another dark shade
    //     primaryColor: '#333', // Darker nodes
    //     primaryTextColor: '#e0e0e0',
    //     lineColor: '#aaa',
    //     fontSize: '16px'
    // }
});

// 定义Mermaid语法高亮模式
CodeMirror.defineSimpleMode("mermaid", {
    // 开始状态
    start: [
        // 注释
        {regex: /%%.*/, token: "comment"},
        // 图表类型关键字
        {regex: /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitGraph)\b/, token: "keyword"},
        // 方向关键字
        {regex: /\b(TB|TD|BT|RL|LR)\b/, token: "keyword"},
        // 节点定义
        {regex: /\b([A-Za-z0-9_]+)\b/, token: "def"},
        // 节点形状
        {regex: /\[([^\]]*)\]|\(([^\)]*)\)|\{([^\}]*)\}|\>([^\>]*)\]|\[\[([^\]]*)\]\]|\[\(([^\)]*)\)\]|\[\/([^/]*)\/\]|\[\\([^\]]*)\\\]/, token: "string"},
        // 连接符
        {regex: /(-\.-|-\.->|===>|-->|==>|-.->|~~\|)/, token: "operator"},
        // 连接标签
        {regex: /\|([^|]*)\|/, token: "string"},
        // 子图
        {regex: /\b(subgraph|end)\b/, token: "keyword"},
        // 类图关键字
        {regex: /\b(class|interface|extends|implements)\b/, token: "keyword"},
        // 状态图关键字
        {regex: /\b(state|note|as)\b/, token: "keyword"},
        // 序列图关键字
        {regex: /\b(participant|actor|activate|deactivate|note|loop|alt|else|opt|par|and|rect|end)\b/, token: "keyword"},
        // 甘特图关键字
        {regex: /\b(title|dateFormat|section|task)\b/, token: "keyword"},
        // 字符串
        {regex: /"([^"]*)"|'([^']*)'/,  token: "string"},
        // 括号
        {regex: /[\[\]\{\}\(\)]/, token: "bracket"},
        // 其他操作符
        {regex: /[:;,]/, token: "operator"}
    ],
    meta: {
        dontIndentStates: ["comment"],
        lineComment: "%%"
    }
});

// 创建CodeMirror编辑器实例
let editor;

// 当页面加载完成时初始化编辑器和渲染初始图表
document.addEventListener('DOMContentLoaded', () => {
    // 初始化CodeMirror编辑器
    const textArea = document.getElementById('mermaidInput');
    editor = CodeMirror.fromTextArea(textArea, {
        mode: "mermaid",
        theme: "mermaid-dark",
        lineNumbers: true,
        lineWrapping: true,
        styleActiveLine: true,
        scrollbarStyle: "simple",
        matchBrackets: true,
        autoCloseBrackets: true,
        tabSize: 4,
        indentWithTabs: true,
        extraKeys: {
            "Tab": function(cm) {
                if (cm.somethingSelected()) {
                    cm.indentSelection("add");
                } else {
                    cm.replaceSelection("    ", "end");
                }
            }
        }
    });
    
    // 监听编辑器内容变化，实时更新预览
    editor.on("change", () => {
        renderMermaid();
    });
    
    // 渲染初始图表
    renderMermaid();
});

// 渲染Mermaid图表
async function renderMermaid() {
    // 从CodeMirror编辑器获取内容
    const input = editor ? editor.getValue() : document.getElementById('mermaidInput').value;
    const preview = document.getElementById('preview');
    const errorMessage = document.getElementById('errorMessage');

    try {
        // 清空预览区域
        preview.innerHTML = '';
        errorMessage.style.display = 'none';

        // 渲染新图表
        const { svg } = await mermaid.render('mermaid-diagram', input);
        preview.innerHTML = svg;

        // Add click listener for fullscreen after successful rendering
        const svgElement = preview.querySelector('svg');
        if (svgElement) {
            svgElement.style.cursor = 'pointer'; // Indicate clickable
            svgElement.onclick = () => openFullscreen(svgElement);
        }
    } catch (error) {
        // Handle rendering errors
        errorMessage.textContent = '图表语法错误：' + error.message;
        errorMessage.style.display = 'block';
        // Ensure preview is cleared on error too
        preview.innerHTML = '';
    }
}

// --- Fullscreen Preview and Zoom Logic ---

const previewContainer = document.getElementById('preview');
const fullscreenPreview = document.getElementById('fullscreenPreview');
const fullscreenContent = document.getElementById('fullscreenContent');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const resetZoomBtn = document.getElementById('resetZoomBtn');
const closeFullscreenBtn = document.getElementById('closeFullscreenBtn');

let currentScale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let startX, startY;
let fullscreenSvg = null;

function openFullscreen(originalSvg) {
    if (!originalSvg) return;

    // Clone the SVG to avoid modifying the original preview
    fullscreenSvg = originalSvg.cloneNode(true);
    fullscreenSvg.style.width = '100%'; // Adjust initial size if needed
    fullscreenSvg.style.height = '100%';
    fullscreenSvg.style.maxWidth = 'none';
    fullscreenSvg.style.maxHeight = 'none';
    fullscreenSvg.style.cursor = 'grab'; // Indicate draggable
    fullscreenSvg.style.transformOrigin = 'center center'; // Zoom from center initially
    fullscreenSvg.style.transition = 'transform 0.1s ease-out'; // Smooth transitions

    // Clear previous content and add the new SVG
    fullscreenContent.innerHTML = '';
    fullscreenContent.appendChild(fullscreenSvg);

    // Reset state and apply initial transform
    resetZoomState();
    applyTransform();

    // Show fullscreen
    fullscreenPreview.style.display = 'flex'; // Use flex to center content

    // Add event listeners
    closeFullscreenBtn.addEventListener('click', closeFullscreen);
    zoomInBtn.addEventListener('click', zoomIn);
    zoomOutBtn.addEventListener('click', zoomOut);
    resetZoomBtn.addEventListener('click', resetZoom);
    fullscreenPreview.addEventListener('wheel', handleWheelZoom); // Use the container for wheel events
    fullscreenSvg.addEventListener('mousedown', startDrag);
    fullscreenPreview.addEventListener('mousemove', drag); // Listen on container to capture mouse outside SVG
    fullscreenPreview.addEventListener('mouseup', endDrag);
    fullscreenPreview.addEventListener('mouseleave', endDrag); // Stop dragging if mouse leaves container
}

function closeFullscreen() {
    fullscreenPreview.style.display = 'none';
    fullscreenContent.innerHTML = ''; // Clear content
    fullscreenSvg = null; // Release reference

    // Remove event listeners (important to prevent memory leaks)
    closeFullscreenBtn.removeEventListener('click', closeFullscreen);
    zoomInBtn.removeEventListener('click', zoomIn);
    zoomOutBtn.removeEventListener('click', zoomOut);
    resetZoomBtn.removeEventListener('click', resetZoom);
    fullscreenPreview.removeEventListener('wheel', handleWheelZoom);
    // Drag listeners are removed implicitly when fullscreenSvg is null or in endDrag
}

function applyTransform() {
    if (fullscreenSvg) {
        fullscreenSvg.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${currentScale})`;
    }
}

function resetZoomState() {
    currentScale = 1;
    offsetX = 0;
    offsetY = 0;
}

function resetZoom() {
    resetZoomState();
    applyTransform();
}

function zoomIn() {
    currentScale *= 1.2;
    applyTransform();
}

function zoomOut() {
    currentScale /= 1.2;
    applyTransform();
}

function handleWheelZoom(event) {
    event.preventDefault(); // Prevent page scrolling

    if (!fullscreenSvg) return;

    const zoomIntensity = 0.1;
    const delta = event.deltaY > 0 ? -1 : 1; // Negative for zoom out, positive for zoom in
    const scaleAmount = 1 + delta * zoomIntensity;

    // Get mouse position relative to the fullscreen container
    const rect = fullscreenPreview.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Calculate the point on the SVG under the mouse
    // Inverse transform: map screen coords to SVG coords before scaling
    const svgPointX = (mouseX - offsetX) / currentScale;
    const svgPointY = (mouseY - offsetY) / currentScale;

    // Update scale
    currentScale *= scaleAmount;

    // Adjust offset to keep the point under the mouse stationary
    offsetX = mouseX - svgPointX * currentScale;
    offsetY = mouseY - svgPointY * currentScale;


    applyTransform();
}

function startDrag(event) {
    if (!fullscreenSvg) return;
    event.preventDefault();
    isDragging = true;
    startX = event.clientX - offsetX;
    startY = event.clientY - offsetY;
    fullscreenSvg.style.cursor = 'grabbing'; // Change cursor
    fullscreenSvg.style.transition = 'none'; // Disable transition during drag for responsiveness
}

function drag(event) {
    if (!isDragging || !fullscreenSvg) return;
    event.preventDefault();
    offsetX = event.clientX - startX;
    offsetY = event.clientY - startY;
    applyTransform();
}

function endDrag(event) {
    if (!isDragging || !fullscreenSvg) return;
    event.preventDefault();
    isDragging = false;
    fullscreenSvg.style.cursor = 'grab'; // Restore cursor
    fullscreenSvg.style.transition = 'transform 0.1s ease-out'; // Re-enable transition
}


// --- Existing Functions ---

// 复制图像到剪贴板
async function copyImage() {
    try {
        const preview = document.getElementById('preview');
        const svgElement = preview.querySelector('svg');
        if (!svgElement) {
            alert('找不到要复制的图表 SVG 元素。');
            return;
        }

        const padding = 20; // 设置内边距

        // 1. 获取 SVG 的实际尺寸
        const bbox = svgElement.getBBox();
        const svgWidth = bbox.width;
        const svgHeight = bbox.height;

        // 2. 创建一个新的 Canvas
        const canvas = document.createElement('canvas');
        const scaleFactor = 2; // 提高分辨率
        const canvasWidth = (svgWidth + 2 * padding) * scaleFactor;
        const canvasHeight = (svgHeight + 2 * padding) * scaleFactor;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');

        // 应用缩放
        ctx.scale(scaleFactor, scaleFactor);

        // 3. 填充背景色 (Use dark background matching the theme)
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvasWidth / scaleFactor, canvasHeight / scaleFactor);

        // 4. 将 SVG 转换为 Data URL
        const clonedSvgElement = svgElement.cloneNode(true);
        const svgXml = new XMLSerializer().serializeToString(clonedSvgElement);
        const svgBase64 = btoa(unescape(encodeURIComponent(svgXml)));
        const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;

        // 5. 创建 Image 对象加载 SVG Data URL
        const img = new Image();
        img.onload = () => {
            // 6. 将图像绘制到 Canvas 中心
            ctx.drawImage(img, padding, padding, svgWidth, svgHeight);

            // 7. 将 Canvas 内容转换为 Blob 并复制到剪贴板
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    alert('无法生成图像 Blob 进行复制。');
                    return;
                }
                try {
                    // 使用 ClipboardItem 构造函数
                    const data = new ClipboardItem({ 'image/png': blob });
                    await navigator.clipboard.write([data]);
                    alert('图像已复制到剪贴板！');
                } catch (error) {
                    console.error('复制到剪贴板失败:', error);
                    alert('复制失败：' + error.message + '\n\n请注意：某些浏览器可能限制脚本直接写入剪贴板，或者需要用户授权。');
                }
            }, 'image/png'); // 指定 MIME 类型为 image/png
        };
        img.onerror = (error) => {
            console.error('加载 SVG 图像失败:', error);
            alert('加载 SVG 图像失败，无法复制。');
        };
        img.src = svgDataUrl;

    } catch (error) {
        console.error('复制图像时出错:', error);
        alert('生成图像失败：' + error.message);
    }
}

// 下载图像
async function downloadImage() {
    try {
        const preview = document.getElementById('preview');
        const svgElement = preview.querySelector('svg');
        if (!svgElement) {
            alert('找不到要下载的图表 SVG 元素。');
            return;
        }

        const fileName = document.getElementById('fileName').value || 'mermaid-diagram';
        const padding = 20; // 设置内边距

        // 1. 获取 SVG 的实际尺寸
        // 注意：getBBox() 可能在某些浏览器或复杂 SVG 中不完全准确，但通常足够
        const bbox = svgElement.getBBox();
        const svgWidth = bbox.width;
        const svgHeight = bbox.height;

        // 如果 bbox 返回 0 或无效值，尝试使用 viewBox 或 client/scroll 尺寸作为后备
        // (为简化起见，此处省略后备逻辑)

        // 2. 创建一个新的 Canvas
        const canvas = document.createElement('canvas');
        // 为了提高分辨率，可以乘以一个比例因子，例如 2
        const scaleFactor = 2;
        const canvasWidth = (svgWidth + 2 * padding) * scaleFactor;
        const canvasHeight = (svgHeight + 2 * padding) * scaleFactor;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');

        // 应用缩放
        ctx.scale(scaleFactor, scaleFactor);

        // 3. (可选) 填充背景色 (Use dark background matching the theme)
        ctx.fillStyle = '#1a1a1a'; // 设置背景为深色
        // 注意：填充时使用未缩放的坐标和尺寸
        ctx.fillRect(0, 0, canvasWidth / scaleFactor, canvasHeight / scaleFactor);

        // 4. 将 SVG 转换为 Data URL
        // 克隆 SVG 以避免修改原始预览中的样式
        const clonedSvgElement = svgElement.cloneNode(true);
        // 移除可能影响渲染的外部样式或脚本（如果需要）
        // ...

        const svgXml = new XMLSerializer().serializeToString(clonedSvgElement);
        // 使用 unescape(encodeURIComponent()) 处理非 ASCII 字符
        const svgBase64 = btoa(unescape(encodeURIComponent(svgXml)));
        const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;

        // 5. 创建 Image 对象加载 SVG Data URL
        const img = new Image();
        img.onload = () => {
            // 6. 将图像绘制到 Canvas 中心（已包含内边距）
            // 绘制时使用未缩放的坐标和尺寸
            ctx.drawImage(img, padding, padding, svgWidth, svgHeight);

            // 7. 创建下载链接
            const link = document.createElement('a');
            link.download = `${fileName}.png`;
            // 从 Canvas 获取高质量的 PNG 数据
            link.href = canvas.toDataURL('image/png');

            // 8. 触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        img.onerror = (error) => {
            console.error('加载 SVG 图像失败:', error);
            // 尝试提供更具体的错误信息
            alert('加载 SVG 图像失败，无法下载。请检查浏览器控制台获取详细信息。');
        };
        img.src = svgDataUrl;

    } catch (error) {
        console.error('下载图像时出错:', error);
        alert('下载失败：' + error.message);
    }
}
