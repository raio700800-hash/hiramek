/**
 * =============================================================================
 * 🕸️ マインドマップ ツリー描画キャンバス (treeCanvas.js)
 * =============================================================================
 * 要約タイトルがしっかり2行まで読めるゆったり幅（260px）。
 * 種別タグ（💡 アイデア等）を明示し、ボタン（✏️, ＋, ×）は選択時・ホバー時のみ浮かび上がる
 * 最高にスッキリして見やすいデザインです。
/**
 * 🛡️ 安全なHTMLエスケープ関数（XSS / 属性ブレイク防止）
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class MindMapTreeCanvas {
  constructor(containerId, state, onEditNodeCallback, onAddChildCallback, onEditFrameCallback) {
    this.container = document.getElementById(containerId);
    this.state = state;
    this.onEditNode = onEditNodeCallback || (() => {});
    this.onAddChild = onAddChildCallback || null;
    this.onEditFrame = onEditFrameCallback || (() => {});

    this.panX = 80;
    this.panY = 180;
    this.scale = 1.0;

    this.isPanning = false;
    this.startPanX = 0;
    this.startPanY = 0;

    this.draggingNodeId = null;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.nodeInitialX = 0;
    this.nodeInitialY = 0;
    this.hasMovedDuringDrag = false;

    // 要約タイトルがしっかり読める適正寸法
    this.nodeWidth = 260;
    this.nodeHeight = 64;
    this.horizontalGap = 80;
    this.verticalGap = 24;

    // 🌿 3大レイアウトモード（'radial-tree'中央放射型, 'horizontal-tree'水平ツリー, 'freeform'自由配置）
    this.layoutMode = (this.state.data.settings && this.state.data.settings.layoutMode) || 'radial-tree';

    // 📦 複数選択（Shiftキー）＆ グループ追加モード管理
    this.selectedNodeIds = new Set();
    this.addingToGroup = null;        // 編集中グループ名
    this.addingToGroupColor = null;   // 編集中グループ色

    // 🖼️ 独立フレームのドラッグ＆リサイズ管理
    this.draggingFrameId = null;
    this.resizingFrameId = null;
    this.resizeDirection = null;     // 'nw', 'ne', 'se', 'sw'
    this.frameDragStartX = 0;
    this.frameDragStartY = 0;
    this.frameInitialRect = null;
    this.frameInitialPositions = {};
    this.hasMovedDuringFrameDrag = false;
    this.lastFrameDx = 0;
    this.lastFrameDy = 0;

    this.initDOM();
    this.attachEvents();
    this.render();
  }

  initDOM() {
    this.container.innerHTML = `
      <div id="canvas-viewport" class="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing canvas-bg-grid">
        <div id="canvas-world" class="absolute top-0 left-0 pointer-events-auto" style="transform-origin: 0 0;">
          <!-- 🖼️ Miro風フレームレイヤー (最背面) -->
          <div id="canvas-frames-layer" class="absolute top-0 left-0 pointer-events-auto" style="z-index: 0;"></div>
          <!-- 🔗 接続線SVGレイヤー -->
          <svg id="canvas-svg" class="absolute top-0 left-0 pointer-events-none" style="overflow: visible; width: 1px; height: 1px; z-index: 1;">
            <g id="svg-edges-group"></g>
          </svg>
          <!-- 📝 ノードレイヤー -->
          <div id="canvas-nodes-layer" class="absolute top-0 left-0 pointer-events-auto" style="z-index: 2;"></div>
        </div>

        <!-- 🌟 ミル造さんご要望: ノードツリー右側に小さく重ねて表示するグループクイックナビゲーター -->
        <div id="group-navigator-overlay" class="absolute top-16 right-4 z-20 flex flex-col items-end gap-1.5 pointer-events-auto max-w-xs transition-opacity duration-200"></div>
      </div>
    `;

    this.viewport = document.getElementById('canvas-viewport');
    this.world = document.getElementById('canvas-world');
    this.framesLayer = document.getElementById('canvas-frames-layer');
    this.svgEdgesGroup = document.getElementById('svg-edges-group');
    this.nodesLayer = document.getElementById('canvas-nodes-layer');
    this.groupNavigatorOverlay = document.getElementById('group-navigator-overlay');
  }

  attachEvents() {
    this.viewport.addEventListener('mousedown', (e) => {
      if (e.target.closest('.mind-node') || e.target.closest('button') || e.target.closest('input')) return;
      if (!e.shiftKey) {
        this.clearMultiSelection();
      }
      this.isPanning = true;
      this.startPanX = e.clientX - this.panX;
      this.startPanY = e.clientY - this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.panX = e.clientX - this.startPanX;
        this.panY = e.clientY - this.startPanY;
        this.applyTransform();
        return;
      }

      if (this.draggingNodeId) {
        this.hasMovedDuringDrag = true;
        const dx = (e.clientX - this.dragStartX) / this.scale;
        const dy = (e.clientY - this.dragStartY) / this.scale;
        const newX = Math.round(this.nodeInitialX + dx);
        const newY = Math.round(this.nodeInitialY + dy);

        const elm = document.getElementById(`node-elm-${this.draggingNodeId}`);
        if (elm) {
          elm.style.left = `${newX}px`;
          elm.style.top = `${newY}px`;
        }

        const node = this.state.data.nodes[this.draggingNodeId];
        if (node) {
          node.x = newX;
          node.y = newY;
        }

        this.renderEdgesOnly();
        this.renderFramesOnly();
        return;
      }

      // 🖼️ 独立フレームのドラッグ移動（フレーム＋枠内ノード一括追従）
      if (this.draggingFrameId) {
        this.hasMovedDuringFrameDrag = true;
        const dx = (e.clientX - this.frameDragStartX) / this.scale;
        const dy = (e.clientY - this.frameDragStartY) / this.scale;
        this.lastFrameDx = dx;
        this.lastFrameDy = dy;

        // フレーム自身のDOM移動
        const frameElm = document.getElementById(`frame-elm-${this.draggingFrameId}`);
        if (frameElm && this.frameInitialRect) {
          frameElm.style.left = `${Math.round(this.frameInitialRect.x + dx)}px`;
          frameElm.style.top = `${Math.round(this.frameInitialRect.y + dy)}px`;
        }

        // 枠内ノードのDOM移動＆座標追従
        Object.entries(this.frameInitialPositions).forEach(([id, pos]) => {
          const newX = Math.round(pos.x + dx);
          const newY = Math.round(pos.y + dy);
          const node = this.state.data.nodes[id];
          if (node) {
            node.x = newX;
            node.y = newY;
          }
          const elm = document.getElementById(`node-elm-${id}`);
          if (elm) {
            elm.style.left = `${newX}px`;
            elm.style.top = `${newY}px`;
          }
        });

        this.renderEdgesOnly();
        return;
      }

      // 🖼️ 独立フレームのリサイズ（四隅ハンドルドラッグ）
      if (this.resizingFrameId) {
        this.hasMovedDuringFrameDrag = true;
        const dx = (e.clientX - this.frameDragStartX) / this.scale;
        const dy = (e.clientY - this.frameDragStartY) / this.scale;
        this.lastFrameDx = dx;
        this.lastFrameDy = dy;

        const rect = this.frameInitialRect;
        if (rect) {
          let newX = rect.x;
          let newY = rect.y;
          let newW = rect.width;
          let newH = rect.height;

          const dir = this.resizeDirection;
          if (dir === 'se') {
            newW = Math.max(rect.width + dx, 180);
            newH = Math.max(rect.height + dy, 130);
          } else if (dir === 'sw') {
            const rawW = rect.width - dx;
            if (rawW >= 180) {
              newX = rect.x + dx;
              newW = rawW;
            } else {
              newX = rect.x + (rect.width - 180);
              newW = 180;
            }
            newH = Math.max(rect.height + dy, 130);
          } else if (dir === 'ne') {
            newW = Math.max(rect.width + dx, 180);
            const rawH = rect.height - dy;
            if (rawH >= 130) {
              newY = rect.y + dy;
              newH = rawH;
            } else {
              newY = rect.y + (rect.height - 130);
              newH = 130;
            }
          } else if (dir === 'nw') {
            const rawW = rect.width - dx;
            if (rawW >= 180) {
              newX = rect.x + dx;
              newW = rawW;
            } else {
              newX = rect.x + (rect.width - 180);
              newW = 180;
            }
            const rawH = rect.height - dy;
            if (rawH >= 130) {
              newY = rect.y + dy;
              newH = rawH;
            } else {
              newY = rect.y + (rect.height - 130);
              newH = 130;
            }
          }

          const frameElm = document.getElementById(`frame-elm-${this.resizingFrameId}`);
          if (frameElm) {
            frameElm.style.left = `${Math.round(newX)}px`;
            frameElm.style.top = `${Math.round(newY)}px`;
            frameElm.style.width = `${Math.round(newW)}px`;
            frameElm.style.height = `${Math.round(newH)}px`;
          }
          this.currentResizedRect = { x: newX, y: newY, width: newW, height: newH };
        }
        return;
      }

      // 🖼️ （後方互換用）旧グループフレームのドラッグ移動
      if (this.draggingGroupName) {
        this.hasMovedDuringFrameDrag = true;
        const dx = (e.clientX - this.frameDragStartX) / this.scale;
        const dy = (e.clientY - this.frameDragStartY) / this.scale;
        this.lastFrameDx = dx;
        this.lastFrameDy = dy;

        Object.entries(this.frameInitialPositions).forEach(([id, pos]) => {
          const newX = Math.round(pos.x + dx);
          const newY = Math.round(pos.y + dy);
          const node = this.state.data.nodes[id];
          if (node) {
            node.x = newX;
            node.y = newY;
          }
          const elm = document.getElementById(`node-elm-${id}`);
          if (elm) {
            elm.style.left = `${newX}px`;
            elm.style.top = `${newY}px`;
          }
        });

        this.renderEdgesOnly();
        this.renderFramesOnly();
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) this.isPanning = false;

      if (this.draggingNodeId) {
        const nodeId = this.draggingNodeId;
        const node = this.state.data.nodes[nodeId];
        if (node && this.hasMovedDuringDrag) {
          this.state.moveNodePosition(nodeId, node.x, node.y, true);
        }
        this.draggingNodeId = null;
        this.hasMovedDuringDrag = false;
      }

      // 🖼️ 独立フレームのドラッグ移動確定
      if (this.draggingFrameId) {
        const fId = this.draggingFrameId;
        if (this.hasMovedDuringFrameDrag && (this.lastFrameDx || this.lastFrameDy)) {
          Object.entries(this.frameInitialPositions).forEach(([id, pos]) => {
            const node = this.state.data.nodes[id];
            if (node) {
              node.x = pos.x;
              node.y = pos.y;
            }
          });
          this.state.moveFrame(fId, this.lastFrameDx, this.lastFrameDy, true);
        }
        this.draggingFrameId = null;
        this.hasMovedDuringFrameDrag = false;
        this.frameInitialPositions = {};
        this.frameInitialRect = null;
        this.lastFrameDx = 0;
        this.lastFrameDy = 0;
      }

      // 🖼️ 独立フレームのリサイズ確定
      if (this.resizingFrameId) {
        const fId = this.resizingFrameId;
        if (this.hasMovedDuringFrameDrag && this.currentResizedRect) {
          const r = this.currentResizedRect;
          this.state.resizeFrame(fId, r.width, r.height, r.x, r.y, true);
        }
        this.resizingFrameId = null;
        this.resizeDirection = null;
        this.hasMovedDuringFrameDrag = false;
        this.frameInitialRect = null;
        this.currentResizedRect = null;
        this.lastFrameDx = 0;
        this.lastFrameDy = 0;
      }

      // 🖼️ （後方互換用）旧グループフレームのドラッグ確定
      if (this.draggingGroupName) {
        const gName = this.draggingGroupName;
        if (this.hasMovedDuringFrameDrag && (this.lastFrameDx || this.lastFrameDy)) {
          Object.entries(this.frameInitialPositions).forEach(([id, pos]) => {
            const node = this.state.data.nodes[id];
            if (node) {
              node.x = pos.x;
              node.y = pos.y;
            }
          });
          this.state.moveGroupNodes(gName, this.lastFrameDx, this.lastFrameDy, true);
        }
        this.draggingGroupName = null;
        this.hasMovedDuringFrameDrag = false;
        this.frameInitialPositions = {};
        this.lastFrameDx = 0;
        this.lastFrameDy = 0;
      }
    });

    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this.zoomAtPoint(zoomFactor, e.clientX, e.clientY);
    }, { passive: false });

    // タッチ操作
    let lastTouchX = 0, lastTouchY = 0;
    this.viewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1 && !e.target.closest('.mind-node')) {
        this.isPanning = true;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      }
    }, { passive: true });

    this.viewport.addEventListener('touchmove', (e) => {
      if (this.isPanning && e.touches.length === 1) {
        this.panX += e.touches[0].clientX - lastTouchX;
        this.panY += e.touches[0].clientY - lastTouchY;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        this.applyTransform();
      }
    }, { passive: true });

    this.viewport.addEventListener('touchend', () => { this.isPanning = false; });
  }

  zoomAtPoint(factor, clientX, clientY) {
    const rect = this.viewport.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const newScale = Math.min(Math.max(this.scale * factor, 0.35), 2.5);
    if (newScale === this.scale) return;

    this.panX = x - (x - this.panX) * (newScale / this.scale);
    this.panY = y - (y - this.panY) * (newScale / this.scale);
    this.scale = newScale;

    this.applyTransform();
  }

  applyTransform() {
    this.world.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
  }

  /**
   * 🌲 親子ノードのマップを取得
   */
  getChildrenMap() {
    const nodes = this.state.data.nodes;
    const childrenMap = {};
    Object.values(nodes).forEach(n => {
      if (n.parentId) {
        if (!childrenMap[n.parentId]) childrenMap[n.parentId] = [];
        childrenMap[n.parentId].push(n);
      }
    });
    return childrenMap;
  }

  /**
   * 🌲 サブツリー全体の必要高さを再帰計算
   */
  getSubtreeHeight(nodeId, childrenMap) {
    const children = childrenMap[nodeId] || [];
    if (children.length === 0) return this.nodeHeight + this.verticalGap;
    let totalH = 0;
    children.forEach(c => {
      totalH += this.getSubtreeHeight(c.id, childrenMap);
    });
    return Math.max(totalH, this.nodeHeight + this.verticalGap);
  }

  /**
   * 🌲 水平ツリー型レイアウト計算（左から右へ整然と展開）
   */
  layoutHorizontalTree(forceAll = false) {
    const nodes = this.state.data.nodes;
    const rootNode = Object.values(nodes).find(n => !n.parentId) || Object.values(nodes)[0];
    if (!rootNode) return;

    const childrenMap = this.getChildrenMap();

    const assignPos = (node, depth, topY) => {
      const children = childrenMap[node.id] || [];
      const subtreeH = this.getSubtreeHeight(node.id, childrenMap);

      if (forceAll || typeof node.x !== 'number' || typeof node.y !== 'number' || isNaN(node.x) || isNaN(node.y)) {
        node.x = depth * (this.nodeWidth + this.horizontalGap) + 80;
        node.y = topY + (subtreeH / 2) - (this.nodeHeight / 2);
      }

      let currentChildY = topY;
      children.forEach(child => {
        const childH = this.getSubtreeHeight(child.id, childrenMap);
        assignPos(child, depth + 1, currentChildY);
        currentChildY += childH;
      });
    };

    assignPos(rootNode, 0, 100);
  }

  /**
   * 🌟 本格マインドマップ（中央放射型レイアウト計算）
   * - ルートノードを中心に、第1階層を左右均等に分配して放射状に美しく展開
   */
  layoutRadialTree(forceAll = false) {
    const nodes = this.state.data.nodes;
    const rootNode = Object.values(nodes).find(n => !n.parentId) || Object.values(nodes)[0];
    if (!rootNode) return;

    const childrenMap = this.getChildrenMap();
    const directChildren = childrenMap[rootNode.id] || [];

    if (forceAll || typeof rootNode.x !== 'number' || isNaN(rootNode.x)) {
      rootNode.x = 0;
      rootNode.y = 0;
    }

    // 第1階層の子ノードを左右にバランスよく振り分け（偶数番目は右、奇数番目は左）
    const rightChildren = [];
    const leftChildren = [];
    directChildren.forEach((child, idx) => {
      if (idx % 2 === 0) {
        rightChildren.push(child);
      } else {
        leftChildren.push(child);
      }
    });

    let rightTotalH = 0;
    rightChildren.forEach(c => { rightTotalH += this.getSubtreeHeight(c.id, childrenMap); });
    rightTotalH = Math.max(rightTotalH, this.nodeHeight);

    let leftTotalH = 0;
    leftChildren.forEach(c => { leftTotalH += this.getSubtreeHeight(c.id, childrenMap); });
    leftTotalH = Math.max(leftTotalH, this.nodeHeight);

    // 再帰的にブランチを配置（dir: 1=右展開, -1=左展開）
    const assignBranchPos = (node, depth, topY, dir) => {
      const children = childrenMap[node.id] || [];
      const subtreeH = this.getSubtreeHeight(node.id, childrenMap);

      if (forceAll || typeof node.x !== 'number' || isNaN(node.x)) {
        if (dir === 1) {
          node.x = rootNode.x + this.nodeWidth + this.horizontalGap + (depth - 1) * (this.nodeWidth + this.horizontalGap);
        } else {
          node.x = rootNode.x - (this.nodeWidth + this.horizontalGap) - (depth - 1) * (this.nodeWidth + this.horizontalGap);
        }
        node.y = topY + (subtreeH / 2) - (this.nodeHeight / 2);
      }

      let currentChildY = topY;
      children.forEach(child => {
        const childH = this.getSubtreeHeight(child.id, childrenMap);
        assignBranchPos(child, depth + 1, currentChildY, dir);
        currentChildY += childH;
      });
    };

    // 右側ブランチ
    let rightStartY = rootNode.y + (this.nodeHeight / 2) - (rightTotalH / 2);
    rightChildren.forEach(child => {
      const childH = this.getSubtreeHeight(child.id, childrenMap);
      assignBranchPos(child, 1, rightStartY, 1);
      rightStartY += childH;
    });

    // 左側ブランチ
    let leftStartY = rootNode.y + (this.nodeHeight / 2) - (leftTotalH / 2);
    leftChildren.forEach(child => {
      const childH = this.getSubtreeHeight(child.id, childrenMap);
      assignBranchPos(child, 1, leftStartY, -1);
      leftStartY += childH;
    });
  }

  /**
   * 座標の安全補完
   */
  ensureNodePositions() {
    if (this.layoutMode === 'radial-tree') {
      this.layoutRadialTree(false);
    } else if (this.layoutMode === 'horizontal-tree') {
      this.layoutHorizontalTree(false);
    } else {
      // freeform: 未設定ノードのみ水平フォールバック
      this.layoutHorizontalTree(false);
    }
  }

  /**
   * 📐 ツールバーからのレイアウト切替（即時再整列＆センタリング）
   */
  setLayoutMode(mode) {
    if (!['radial-tree', 'horizontal-tree', 'freeform'].includes(mode)) return;
    this.layoutMode = mode;
    this.state.setLayoutMode(mode);

    if (mode === 'radial-tree') {
      this.layoutRadialTree(true);
    } else if (mode === 'horizontal-tree') {
      this.layoutHorizontalTree(true);
    }
    // freeform の場合は現在の位置を維持

    this.state.saveState();
    this.render();
    this.fitView();
  }

  /**
   * 🧹 自動整列（フレーム同士の衝突回避付き）
   */
  tidyLayout() {
    if (this.layoutMode === 'freeform') {
      this.setLayoutMode('radial-tree');
    } else {
      this.setLayoutMode(this.layoutMode);
    }
    this.avoidFrameOverlaps();
    this.render();
  }

  /**
   * 🖼️ 複数フレームが存在する場合、フレーム同士が絶対に重ならないよう衝突回避整列
   */
  avoidFrameOverlaps() {
    const frames = this.state.data.frames;
    if (!frames) return;
    const frameList = Object.values(frames);
    if (frameList.length <= 1) return;

    // フレームをX座標昇順でソート
    frameList.sort((a, b) => (a.x || 0) - (b.x || 0));

    const margin = 80; // フレーム間の十分な余白

    for (let i = 0; i < frameList.length; i++) {
      for (let j = i + 1; j < frameList.length; j++) {
        const fA = frameList[i];
        const fB = frameList[j];

        // 重なり判定 (AABB)
        const aRight = fA.x + fA.width + margin;
        const bRight = fB.x + fB.width + margin;
        const aBottom = fA.y + fA.height + margin;
        const bBottom = fB.y + fB.height + margin;

        const overlapX = (fA.x < bRight) && (aRight > fB.x);
        const overlapY = (fA.y < bBottom) && (aBottom > fB.y);

        if (overlapX && overlapY) {
          // X方向に衝突解消: fB を fA の右側へ押し出す
          const shiftX = Math.round(aRight - fB.x);
          this.state.moveFrame(fB.id, shiftX, 0, false);
        }
      }
    }
  }

  /**
   * 🔗 接続線SVG描画（左右双方向の滑らかなS字ベジェ曲線）
   */
  renderEdgesOnly() {
    const nodes = this.state.data.nodes;
    const selectedId = this.state.data.selectedNodeId;
    let svgHtml = '';

    Object.values(nodes).forEach(node => {
      if (!node.parentId || !nodes[node.parentId]) return;
      const parent = nodes[node.parentId];

      // 相対位置を自動判定（子が親の右側にあるか、左側にあるか）
      const isRight = (node.x || 0) >= (parent.x || 0);

      let sx, tx;
      if (isRight) {
        // 親の右端 ➔ 子の左端
        sx = (parent.x || 0) + this.nodeWidth;
        tx = node.x || 0;
      } else {
        // 親の左端 ➔ 子の右端
        sx = parent.x || 0;
        tx = (node.x || 0) + this.nodeWidth;
      }

      const sy = (parent.y || 0) + (this.nodeHeight / 2);
      const ty = (node.y || 0) + (this.nodeHeight / 2);

      const dx = Math.max(Math.abs(tx - sx) * 0.55, 30);
      const dir = isRight ? 1 : -1;
      const d = `M ${sx} ${sy} C ${sx + dx * dir} ${sy}, ${tx - dx * dir} ${ty}, ${tx} ${ty}`;
      const isHighlighted = node.id === selectedId || parent.id === selectedId;

      svgHtml += `<path d="${d}" class="tree-edge ${isHighlighted ? 'highlighted' : ''}" />`;
    });

    this.svgEdgesGroup.innerHTML = svgHtml;
  }

  render() {
    this.ensureNodePositions();
    const nodes = this.state.data.nodes;
    const selectedId = this.state.data.selectedNodeId;
    const customTags = this.state.data.customTags || [];

    this.renderEdgesOnly();
    this.renderFrames();

    let nodesHtml = '';
    Object.values(nodes).forEach(node => {
      const isSelected = node.id === selectedId;

      // 🏷️ 第1タグ: 大枠の種別（アイデア、タスク、課題、目標など）
      const typeInfo = {
        Idea: { icon: '💡', label: 'アイデア', style: 'text-blue-700 bg-blue-50 border-blue-200' },
        Task: { icon: '📋', label: 'タスク', style: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
        Problem: { icon: '⚠️', label: '課題', style: 'text-rose-700 bg-rose-50 border-rose-200' },
        Fact: { icon: '📌', label: '前提・事実', style: 'text-purple-700 bg-purple-50 border-purple-200' },
        Question: { icon: '❓', label: '疑問・問い', style: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
        Goal: { icon: '🎯', label: '目標・ゴール', style: 'text-amber-800 bg-amber-100 border-amber-300' },
        Inspiration: { icon: '✨', label: 'ひらめき', style: 'text-pink-700 bg-pink-50 border-pink-200' },
        Reference: { icon: '📚', label: '参考', style: 'text-indigo-700 bg-indigo-50 border-indigo-200' }
      };
      const type = typeInfo[node.nodeType] || typeInfo.Idea;

      // 🏷️ 第2タグ: 役割・性質（仕組み、解決策、工夫点、検証、視点など）
      const roleTagInfo = {
        Mechanism: { icon: '🔧', label: '仕組み', style: 'text-purple-700 bg-purple-50 border-purple-200' },
        Solution: { icon: '💡', label: '解決策', style: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
        Ingenuity: { icon: '✨', label: '工夫点', style: 'text-amber-700 bg-amber-50 border-amber-200' },
        Verification: { icon: '🧪', label: '検証タスク', style: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
        Perspective: { icon: '👁️', label: '視点', style: 'text-blue-700 bg-blue-50 border-blue-200' },
        Approach: { icon: '🎯', label: 'アプローチ', style: 'text-indigo-700 bg-indigo-50 border-indigo-200' }
      };

      // 🏷️ 第2タグの決定（未設定・既存ノードでも必ず「アイデアタグと同じ美しいピル」を2つ揃えて表示！）
      let secondTagData = null;
      if (node.roleTag && node.roleTag !== 'None' && roleTagInfo[node.roleTag]) {
        secondTagData = roleTagInfo[node.roleTag];
      } else if (!node.parentId) {
        // ルートノード
        secondTagData = { icon: '🌟', label: 'テーマ', style: 'text-amber-800 bg-amber-50 border-amber-300' };
      } else {
        // 既存ノードや未設定ノードのテキスト文脈から自動推論
        const rawText = (node.title || '') + ' ' + (node.content || '');
        if (/仕組み|しくみ|機構|同期|レイアウト|indexeddb|永続化|検索/i.test(rawText)) {
          secondTagData = roleTagInfo.Mechanism;
        } else if (/視点|ユーザー|初心者|実践|整理派/i.test(rawText)) {
          secondTagData = roleTagInfo.Perspective;
        } else if (/工夫|心地よさ|タッチ|操作|デザイン|ui|余白/i.test(rawText)) {
          secondTagData = roleTagInfo.Ingenuity;
        } else if (/タスク|検証|テスト|試作|ステップ|アクション/i.test(rawText)) {
          secondTagData = roleTagInfo.Verification;
        } else if (/連携|notion|slack|discord|カレンダー|todo|obsidian|アプローチ|解決|自動化/i.test(rawText)) {
          secondTagData = roleTagInfo.Solution;
        } else {
          secondTagData = (node.nodeType === 'Task') ? roleTagInfo.Verification : roleTagInfo.Solution;
        }
      }

      // アイデアタグとまったく同一の形状・フォント・パディングを持つ2つのピル型タグ
      const firstTagHtml = `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border shadow-2xs shrink-0 ${type.style}">
          <span>${type.icon}</span>
          <span>${type.label}</span>
        </span>
      `;

      const secondTagHtml = `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border shadow-2xs shrink-0 ${secondTagData.style}">
          <span>${secondTagData.icon}</span>
          <span>${secondTagData.label}</span>
        </span>
      `;

      // 🎨 カラーパレットテーマの決定
      const nodeColor = node.color || 'default';
      const colorStyleMap = {
        default: { bg: 'bg-white', border: 'border-slate-200/90', activeBorder: 'ring-2 ring-blue-500 border-blue-500', groupBg: 'bg-slate-100 text-slate-700 border-slate-300' },
        blue: { bg: 'bg-blue-50/80', border: 'border-blue-300', activeBorder: 'ring-2 ring-blue-500 border-blue-500', groupBg: 'bg-blue-100 text-blue-800 border-blue-300' },
        green: { bg: 'bg-emerald-50/80', border: 'border-emerald-300', activeBorder: 'ring-2 ring-emerald-500 border-emerald-500', groupBg: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
        amber: { bg: 'bg-amber-50/90', border: 'border-amber-300', activeBorder: 'ring-2 ring-amber-500 border-amber-500', groupBg: 'bg-amber-100 text-amber-900 border-amber-300' },
        purple: { bg: 'bg-purple-50/80', border: 'border-purple-300', activeBorder: 'ring-2 ring-purple-500 border-purple-500', groupBg: 'bg-purple-100 text-purple-800 border-purple-300' },
        rose: { bg: 'bg-rose-50/80', border: 'border-rose-300', activeBorder: 'ring-2 ring-rose-500 border-rose-500', groupBg: 'bg-rose-100 text-rose-800 border-rose-300' },
        orange: { bg: 'bg-orange-50/80', border: 'border-orange-300', activeBorder: 'ring-2 ring-orange-500 border-orange-500', groupBg: 'bg-orange-100 text-orange-900 border-orange-300' }
      };
      const theme = colorStyleMap[nodeColor] || colorStyleMap.default;

      // 📂 グループバッジ（グループ名が設定されている場合）
      const safeGroup = escapeHtml(node.group || '');
      const groupBadgeHtml = safeGroup ? `
        <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded border shadow-2xs shrink-0 ml-auto ${theme.groupBg}" title="グループ: ${safeGroup}">
          <span>📂</span>
          <span class="truncate max-w-[70px]">${safeGroup}</span>
        </span>
      ` : '';

      // タイトルから不要な接頭辞（「視点: 」「答え: 」「解決策: 」等）を自動クリーンアップして純粋な要約に！
      let cleanTitle = (typeof cleanNodeTitle === 'function')
        ? cleanNodeTitle(node.title)
        : (node.title || '').replace(/^(💡|📋|⚠️|🎯|✨|👁️|🔧|答え:|視点:|解決策:|工夫点:|検証タスク:|アクション:)\s*/g, '').trim();
      if (!cleanTitle) cleanTitle = node.title || 'ノード';
      const safeTitle = escapeHtml(cleanTitle);

      const canDelete = Boolean(node.parentId);

      const isMultiSelected = this.selectedNodeIds.has(node.id);
      const isAddingTarget = Boolean(this.addingToGroup && (node.group || '').trim() === this.addingToGroup);

      let visualBorderClass = theme.border;
      if (isMultiSelected) {
        visualBorderClass = 'ring-2 ring-blue-500 shadow-md scale-[1.02] border-blue-400';
      } else if (isSelected) {
        visualBorderClass = `selected ${theme.activeBorder}`;
      }
      if (isAddingTarget) {
        visualBorderClass += ' ring-2 ring-amber-500 ring-offset-1';
      }

      nodesHtml += `
        <div id="node-elm-${node.id}" 
             class="mind-node absolute ${theme.bg} rounded-xl px-3 py-2 border shadow-2xs ${visualBorderClass} flex flex-col justify-center select-none group transition-colors duration-200"
             style="width: ${this.nodeWidth}px; min-height: 68px; left: ${node.x}px; top: ${node.y}px;"
             data-id="${node.id}"
             data-color="${nodeColor}">
          
          <!-- 🌟 外側ボタン 1: ✏️ 編集ボタン（ノードの【左側の上】外側に配置） -->
          <button class="edit-node-btn node-action-btn absolute -top-3.5 -left-3 w-7 h-7 bg-white border border-amber-300 text-amber-600 hover:bg-amber-500 hover:text-white rounded-full flex items-center justify-center shadow-md transition-all duration-150 z-20 hover:scale-110" 
                  title="詳細をエディタで編集" data-id="${node.id}">
            <svg class="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
            </svg>
          </button>

          <!-- 🌟 外側ボタン 2: 🗑️ 削除ボタン（ノードの【右上】外側に赤色ゴミ箱で配置） -->
          ${canDelete ? `
            <button class="delete-btn node-action-btn absolute -top-3.5 -right-3 w-7 h-7 bg-white border border-rose-300 text-rose-500 hover:bg-rose-500 hover:text-white rounded-full flex items-center justify-center shadow-md transition-all duration-150 z-20 hover:scale-110" 
                    title="このノードを削除" data-id="${node.id}">
              <svg class="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          ` : ''}

          <!-- 🌟 外側ボタン 3: ＋ 追加ボタン（ノードの【中央右側】外側に配置） -->
          <button class="add-child-btn node-action-btn absolute top-1/2 -right-4 -translate-y-1/2 w-8 h-8 bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-600 hover:text-white rounded-full flex items-center justify-center shadow-md transition-all duration-150 z-20 hover:scale-110" 
                  title="子ノードを追加" data-id="${node.id}">
            <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path>
            </svg>
          </button>

          <!-- 🏷️ 2タグ表示システム ＋ 📂 グループバッジ -->
          <div class="flex items-center gap-1.5 overflow-hidden flex-nowrap mb-1">
            ${firstTagHtml}
            ${secondTagHtml}
            ${groupBadgeHtml}
          </div>

          <!-- 📝 ノード要約タイトル ＆ 📷 参照画像サムネイル（左横に36x36px配置） -->
          <div class="flex items-center gap-2">
            ${node.image ? `
              <img src="${node.image}" alt="サムネイル" class="node-thumb-img pointer-events-none shrink-0" title="参照画像あり">
            ` : ''}
            <div class="font-bold text-slate-800 text-xs leading-snug line-clamp-2 flex-1 min-w-0" title="${safeTitle}">
              ${safeTitle}
            </div>
          </div>
        </div>
      `;
    });

    this.nodesLayer.innerHTML = nodesHtml;
    this.renderGroupNavigator();
    this.attachNodeElementEvents();
    this.applyTransform();
  }

  attachNodeElementEvents() {
    const nodeElms = this.nodesLayer.querySelectorAll('.mind-node');
    nodeElms.forEach(elm => {
      const nodeId = elm.getAttribute('data-id');

      elm.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;

        // 🎯 1. グループ追加モード中の場合は、ワンクリックで所属トグル！
        if (this.addingToGroup) {
          e.stopPropagation();
          this.state.toggleNodeGroup(nodeId, this.addingToGroup, this.addingToGroupColor);
          return;
        }

        // 📦 2. Shiftキー押下時は複数選択トグル
        if (e.shiftKey) {
          e.stopPropagation();
          if (this.selectedNodeIds.has(nodeId)) {
            this.selectedNodeIds.delete(nodeId);
          } else {
            this.selectedNodeIds.add(nodeId);
          }
          this.state.selectNode(nodeId);
          this.updateFloatingBar();
          this.updateNodeVisualSelection();
          return;
        }

        // 3. 通常選択（Shiftなし）：未選択ノードをクリックした場合は直前の選択をクリア
        if (!this.selectedNodeIds.has(nodeId)) {
          this.selectedNodeIds.clear();
        }
        this.selectedNodeIds.add(nodeId);
        this.updateFloatingBar();

        this.state.selectNode(nodeId);

        this.draggingNodeId = nodeId;
        this.hasMovedDuringDrag = false;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        const node = this.state.data.nodes[nodeId];
        this.nodeInitialX = node ? node.x : 0;
        this.nodeInitialY = node ? node.y : 0;

        e.stopPropagation();
      });

      const editBtn = elm.querySelector('.edit-node-btn');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.state.selectNode(nodeId);
          this.onEditNode(nodeId);
        });
      }

      const addBtn = elm.querySelector('.add-child-btn');
      if (addBtn) {
        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.onAddChild) {
            this.onAddChild(nodeId);
          } else {
            const newTitle = prompt('追加するアイデア・タスクのタイトル:', '新規アイデア');
            if (newTitle && newTitle.trim()) {
              this.state.addNode(nodeId, newTitle.trim());
            }
          }
        });
      }

      const delBtn = elm.querySelector('.delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.state.deleteNode(nodeId);
        });
      }
    });
  }

  /**
   * 📦 複数選択の解除
   */
  clearMultiSelection() {
    this.selectedNodeIds.clear();
    this.updateFloatingBar();
    this.updateNodeVisualSelection();
  }

  /**
   * 📦 画面下部フローティング・グループ化アクションバーの表示更新
   */
  updateFloatingBar() {
    const bar = document.getElementById('floating-multiselect-bar');
    const badge = document.getElementById('multiselect-count-badge');
    const count = this.selectedNodeIds.size;

    if (!bar) return;

    if (count >= 2) {
      if (badge) badge.textContent = `${count}件`;
      bar.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
      bar.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
    } else {
      bar.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
      bar.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
    }
  }

  /**
   * 📦 ノードの視覚的ハイライト更新（Shift複数選択時）
   */
  updateNodeVisualSelection() {
    const selectedId = this.state.data.selectedNodeId;
    const nodeElms = this.nodesLayer.querySelectorAll('.mind-node');
    nodeElms.forEach(elm => {
      const id = elm.getAttribute('data-id');
      const isMulti = this.selectedNodeIds.has(id);
      const isSingle = (id === selectedId);
      elm.classList.toggle('ring-2', isMulti || isSingle);
      elm.classList.toggle('ring-blue-500', isMulti);
      elm.classList.toggle('shadow-md', isMulti);
    });
  }

  /**
   * チャットメッセージがクリックされた時、該当ノードを画面中央へフォーカス＆光らせる
   */
  focusNode(nodeId) {
    const node = this.state.data.nodes[nodeId];
    if (!node) return;

    this.state.selectNode(nodeId);

    // キャンバスをノードの位置へスムーズにスクロール
    const targetX = this.container.clientWidth / 2 - (node.x + this.nodeWidth / 2) * this.scale;
    const targetY = this.container.clientHeight / 2 - (node.y + this.nodeHeight / 2) * this.scale;

    this.panX = Math.round(targetX);
    this.panY = Math.round(targetY);
    this.applyTransform();

    // ノードをピカッと光らせる
    const elm = document.getElementById(`node-elm-${nodeId}`);
    if (elm) {
      elm.classList.remove('node-highlight-pulse');
      void elm.offsetWidth; // リフロー
      elm.classList.add('node-highlight-pulse');
    }
  }

  /**
   * 🗺️ マップの全体表示（全ノードが画面中央に100%収まるよう最適ズーム＆センタリング）
   */
  fitView() {
    const nodes = this.state.data.nodes;
    const nodeValues = Object.values(nodes);
    if (nodeValues.length === 0) {
      this.resetView();
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    nodeValues.forEach(node => {
      const nx = typeof node.x === 'number' ? node.x : 100;
      const ny = typeof node.y === 'number' ? node.y : 100;
      if (nx < minX) minX = nx;
      if (nx + this.nodeWidth > maxX) maxX = nx + this.nodeWidth;
      if (ny < minY) minY = ny;
      if (ny + this.nodeHeight > maxY) maxY = ny + this.nodeHeight;
    });

    const totalW = Math.max(maxX - minX, 100);
    const totalH = Math.max(maxY - minY, 100);

    const containerW = this.container.clientWidth || window.innerWidth || 800;
    const containerH = this.container.clientHeight || window.innerHeight || 600;

    const padding = 80;
    const availW = Math.max(containerW - padding * 2, 200);
    const availH = Math.max(containerH - padding * 2, 200);

    const targetScale = Math.min(Math.max(Math.min(availW / totalW, availH / totalH), 0.35), 1.15);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    this.scale = targetScale;
    this.panX = Math.round(containerW / 2 - centerX * targetScale);
    this.panY = Math.round(containerH / 2 - centerY * targetScale);
    this.applyTransform();
  }

  /**
   * 📂 特定のグループ全体図へズーム＆ジャンプ（ミル造さんご要望機能！）
   */
  focusGroup(groupName) {
    if (!groupName) return;
    const nodes = this.state.data.nodes;
    const groupNodes = Object.values(nodes).filter(n => (n.group || '').trim() === groupName.trim());
    if (groupNodes.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    groupNodes.forEach(node => {
      const nx = typeof node.x === 'number' ? node.x : 100;
      const ny = typeof node.y === 'number' ? node.y : 100;
      if (nx < minX) minX = nx;
      if (nx + this.nodeWidth > maxX) maxX = nx + this.nodeWidth;
      if (ny < minY) minY = ny;
      if (ny + this.nodeHeight > maxY) maxY = ny + this.nodeHeight;
    });

    const totalW = Math.max(maxX - minX, 100);
    const totalH = Math.max(maxY - minY, 100);

    const containerW = this.container.clientWidth || window.innerWidth || 800;
    const containerH = this.container.clientHeight || window.innerHeight || 600;

    const padding = 110;
    const availW = Math.max(containerW - padding * 2, 200);
    const availH = Math.max(containerH - padding * 2, 200);

    const targetScale = Math.min(Math.max(Math.min(availW / totalW, availH / totalH), 0.4), 1.15);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    this.scale = targetScale;
    this.panX = Math.round(containerW / 2 - centerX * targetScale);
    this.panY = Math.round(containerH / 2 - centerY * targetScale);
    this.applyTransform();

    // グループ内の全ノードをピカッと黄金パルス点滅
    groupNodes.forEach(node => {
      const elm = document.getElementById(`node-elm-${node.id}`);
      if (elm) {
        elm.classList.remove('node-highlight-pulse');
        void elm.offsetWidth;
        elm.classList.add('node-highlight-pulse');
      }
    });

    // 先頭のノードを選択状態に
    if (groupNodes.length > 0) {
      this.state.selectNode(groupNodes[0].id);
    }

    // 🖼️ フレーム枠もピカッと光らせる演出
    const frameElm = document.getElementById(`group-frame-${encodeURIComponent(groupName.trim())}`);
    if (frameElm) {
      frameElm.classList.remove('ring-4', 'ring-amber-400');
      void frameElm.offsetWidth;
      frameElm.classList.add('ring-4', 'ring-amber-400');
      setTimeout(() => frameElm && frameElm.classList.remove('ring-4', 'ring-amber-400'), 1500);
    }
  }

  /**
   * 🖼️ 独立フレーム（Miro風大枠）の描画
   */
  renderFrames() {
    if (!this.framesLayer) return;
    const frames = this.state.data.frames || {};
    const frameList = Object.values(frames);

    if (frameList.length === 0) {
      this.framesLayer.innerHTML = '';
      return;
    }

    const isChalkboard = (this.state.data.settings?.theme === 'chalkboard');

    // フレーム配色定義（ホワイトボード用と黒板用の両方に対応：黒板モードはチョーク調の高コントラスト）
    const frameColorMap = {
      default: {
        bg: isChalkboard ? 'bg-emerald-900/20 border-emerald-400/90' : 'bg-slate-100/40 border-slate-300/80',
        headerBg: isChalkboard ? 'bg-slate-900/95 border-emerald-400 text-emerald-300' : 'bg-white border-slate-200 text-slate-700',
        dot: 'bg-slate-400'
      },
      blue: {
        bg: isChalkboard ? 'bg-sky-900/20 border-sky-400/90' : 'bg-blue-50/40 border-blue-300/80',
        headerBg: isChalkboard ? 'bg-slate-900/95 border-sky-400 text-sky-300' : 'bg-white border-blue-200 text-blue-800',
        dot: 'bg-blue-500'
      },
      green: {
        bg: isChalkboard ? 'bg-emerald-900/25 border-emerald-400/90' : 'bg-emerald-50/40 border-emerald-300/80',
        headerBg: isChalkboard ? 'bg-slate-900/95 border-emerald-400 text-emerald-300' : 'bg-white border-emerald-200 text-emerald-800',
        dot: 'bg-emerald-500'
      },
      amber: {
        bg: isChalkboard ? 'bg-amber-900/20 border-amber-300/90' : 'bg-amber-50/40 border-amber-300/80',
        headerBg: isChalkboard ? 'bg-slate-900/95 border-amber-300 text-amber-300' : 'bg-white border-amber-200 text-amber-800',
        dot: 'bg-amber-500'
      },
      purple: {
        bg: isChalkboard ? 'bg-purple-900/20 border-purple-400/90' : 'bg-purple-50/40 border-purple-300/80',
        headerBg: isChalkboard ? 'bg-slate-900/95 border-purple-400 text-purple-300' : 'bg-white border-purple-200 text-purple-800',
        dot: 'bg-purple-500'
      },
      rose: {
        bg: isChalkboard ? 'bg-rose-900/20 border-rose-400/90' : 'bg-rose-50/40 border-rose-300/80',
        headerBg: isChalkboard ? 'bg-slate-900/95 border-rose-400 text-rose-300' : 'bg-white border-rose-200 text-rose-800',
        dot: 'bg-rose-500'
      },
      orange: {
        bg: isChalkboard ? 'bg-orange-900/20 border-orange-300/90' : 'bg-orange-50/40 border-orange-300/80',
        headerBg: isChalkboard ? 'bg-slate-900/95 border-orange-300 text-orange-300' : 'bg-white border-orange-200 text-orange-800',
        dot: 'bg-orange-500'
      }
    };

    let html = '';
    frameList.forEach(frame => {
      const insideNodes = this.state.getNodesInFrame(frame.id);
      const style = frameColorMap[frame.color] || frameColorMap.blue;
      const safeTitle = escapeHtml(frame.title);

      html += `
        <div id="frame-elm-${frame.id}"
             class="canvas-frame-box absolute ${style.bg} border-2 border-dashed rounded-3xl transition-shadow select-none pointer-events-auto shadow-xs hover:border-solid hover:shadow-md"
             style="left: ${frame.x}px; top: ${frame.y}px; width: ${frame.width}px; height: ${frame.height}px;"
             data-frame-id="${frame.id}">
          
          <!-- 📂 フレームヘッダー（ドラッグハンドル：掴んで一括移動！） -->
          <div class="frame-header absolute top-2.5 left-3 flex items-center gap-1.5 px-3 py-1 ${style.headerBg} rounded-full border shadow-2xs cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
               data-frame-id="${frame.id}" title="ドラッグして「${safeTitle}」フレーム全体を一括移動">
            <span class="w-2 h-2 rounded-full ${style.dot} shrink-0"></span>
            <span class="text-xs">🖼️</span>
            <span class="text-xs font-bold truncate max-w-[140px]">${safeTitle}</span>
            <span class="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100/90 rounded-full text-slate-600 font-bold">${insideNodes.length}</span>
            <span class="text-[10px] text-slate-400 pointer-events-none ml-0.5">⋮⋮</span>

            <!-- ✏️ フレーム編集ボタン -->
            <button type="button" class="btn-edit-frame ml-1 p-0.5 text-slate-400 hover:text-blue-600 rounded transition-colors cursor-pointer"
                    data-frame-id="${frame.id}" title="フレームの設定・編集">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
              </svg>
            </button>
          </div>

          <!-- 四隅のリサイズハンドル -->
          <div class="frame-resize-handle frame-resize-nw" data-frame-id="${frame.id}" data-dir="nw" title="左上角をドラッグしてサイズ変更"></div>
          <div class="frame-resize-handle frame-resize-ne" data-frame-id="${frame.id}" data-dir="ne" title="右上角をドラッグしてサイズ変更"></div>
          <div class="frame-resize-handle frame-resize-se" data-frame-id="${frame.id}" data-dir="se" title="右下角をドラッグしてサイズ変更"></div>
          <div class="frame-resize-handle frame-resize-sw" data-frame-id="${frame.id}" data-dir="sw" title="左下角をドラッグしてサイズ変更"></div>
        </div>
      `;
    });

    this.framesLayer.innerHTML = html;
    this.attachFrameEvents();
  }

  /**
   * ドラッグ中の軽量フレーム追従
   */
  renderFramesOnly() {
    this.renderFrames();
  }

  /**
   * フレームヘッダー・リサイズハンドルのイベント配線
   */
  attachFrameEvents() {
    if (!this.framesLayer) return;

    // 1. ヘッダードラッグ
    const headers = this.framesLayer.querySelectorAll('.frame-header');
    headers.forEach(header => {
      header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.btn-edit-frame')) return;
        e.stopPropagation();
        const fId = header.getAttribute('data-frame-id');
        this.startFrameDrag(fId, e.clientX, e.clientY);
      });
    });

    // 2. ✏️ 編集ボタン
    const editBtns = this.framesLayer.querySelectorAll('.btn-edit-frame');
    editBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fId = btn.getAttribute('data-frame-id');
        this.onEditFrame(fId);
      });
    });

    // 3. 四隅リサイズハンドル
    const resizeHandles = this.framesLayer.querySelectorAll('.frame-resize-handle');
    resizeHandles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const fId = handle.getAttribute('data-frame-id');
        const dir = handle.getAttribute('data-dir');
        this.startFrameResize(fId, dir, e.clientX, e.clientY);
      });
    });
  }

  /**
   * 🖼️ フレームのドラッグ開始
   */
  startFrameDrag(frameId, clientX, clientY) {
    const frame = this.state.data.frames ? this.state.data.frames[frameId] : null;
    if (!frame) return;

    this.draggingFrameId = frameId;
    this.frameDragStartX = clientX;
    this.frameDragStartY = clientY;
    this.hasMovedDuringFrameDrag = false;
    this.lastFrameDx = 0;
    this.lastFrameDy = 0;
    this.frameInitialRect = { x: frame.x, y: frame.y, width: frame.width, height: frame.height };

    // 枠内ノードの初期座標をスナップショット保存
    this.frameInitialPositions = {};
    const insideNodes = this.state.getNodesInFrame(frameId);
    insideNodes.forEach(n => {
      this.frameInitialPositions[n.id] = { x: n.x, y: n.y };
    });
  }

  /**
   * 🖼️ フレームのリサイズ開始
   */
  startFrameResize(frameId, dir, clientX, clientY) {
    const frame = this.state.data.frames ? this.state.data.frames[frameId] : null;
    if (!frame) return;

    this.resizingFrameId = frameId;
    this.resizeDirection = dir;
    this.frameDragStartX = clientX;
    this.frameDragStartY = clientY;
    this.hasMovedDuringFrameDrag = false;
    this.lastFrameDx = 0;
    this.lastFrameDy = 0;
    this.frameInitialRect = { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
    this.currentResizedRect = { ...this.frameInitialRect };
  }

  /**
   * 🖼️ 特定フレームへのズーム＆フォーカス
   */
  focusFrame(frameId) {
    const frame = this.state.data.frames ? this.state.data.frames[frameId] : null;
    if (!frame) return;

    const viewportW = this.container.clientWidth || 1000;
    const viewportH = this.container.clientHeight || 700;

    const padding = 100;
    const scaleX = viewportW / (frame.width + padding * 2);
    const scaleY = viewportH / (frame.height + padding * 2);
    let targetScale = Math.min(scaleX, scaleY);
    targetScale = Math.max(0.4, Math.min(1.2, targetScale));

    const frameCenterX = frame.x + (frame.width / 2);
    const frameCenterY = frame.y + (frame.height / 2);

    const targetPanX = (viewportW / 2) - (frameCenterX * targetScale);
    const targetPanY = (viewportH / 2) - (frameCenterY * targetScale);

    this.animateToView(targetPanX, targetPanY, targetScale);

    // フレーム枠を黄金発光演出
    const frameElm = document.getElementById(`frame-elm-${frameId}`);
    if (frameElm) {
      frameElm.classList.remove('ring-4', 'ring-amber-400');
      void frameElm.offsetWidth;
      frameElm.classList.add('ring-4', 'ring-amber-400');
      setTimeout(() => frameElm && frameElm.classList.remove('ring-4', 'ring-amber-400'), 1500);
    }
  }

  /**
   * 🖼️ （後方互換用）旧グループフレームドラッグ開始
   */
  startGroupFrameDrag(groupName, clientX, clientY) {
    this.draggingGroupName = groupName;
    this.frameDragStartX = clientX;
    this.frameDragStartY = clientY;
    this.hasMovedDuringFrameDrag = false;
    this.lastFrameDx = 0;
    this.lastFrameDy = 0;

    this.frameInitialPositions = {};
    const nodes = this.state.data.nodes;
    Object.values(nodes).forEach(n => {
      if ((n.group || '').trim() === groupName) {
        this.frameInitialPositions[n.id] = { x: n.x, y: n.y };
      }
    });
  }

  /**
   * 🌟 マップ右側のグループクイックナビゲーター描画
   */
  renderGroupNavigator() {
    if (!this.groupNavigatorOverlay) return;
    const nodes = this.state.data.nodes;
    const frames = this.state.data.frames || {};
    const frameList = Object.values(frames);

    const groupMap = {};
    Object.values(nodes).forEach(n => {
      const g = (n.group || '').trim();
      if (g) {
        if (!groupMap[g]) {
          groupMap[g] = { name: g, count: 0, color: n.color || 'default' };
        }
        groupMap[g].count++;
        if (n.color && n.color !== 'default') groupMap[g].color = n.color;
      }
    });

    const groups = Object.values(groupMap);
    if (groups.length === 0 && frameList.length === 0) {
      this.groupNavigatorOverlay.innerHTML = '';
      return;
    }

    const dotColorMap = {
      default: 'bg-slate-400',
      blue: 'bg-blue-500',
      green: 'bg-emerald-500',
      amber: 'bg-amber-500',
      purple: 'bg-purple-500',
      rose: 'bg-rose-500',
      orange: 'bg-orange-500'
    };

    // 🎯 1. もしグループ追加モード中なら、専用のナビゲーションカードを表示
    if (this.addingToGroup) {
      const safeTarget = escapeHtml(this.addingToGroup);
      this.groupNavigatorOverlay.innerHTML = `
        <div class="bg-amber-50/95 border-2 border-amber-400 rounded-2xl p-3 shadow-xl flex flex-col gap-2 max-w-[210px] animate-pulse">
          <div class="flex items-center gap-1.5 text-xs font-bold text-amber-900">
            <span>🎯</span>
            <span class="truncate">【${safeTarget}】追加モード</span>
          </div>
          <p class="text-[11px] text-slate-900 leading-tight">
            ノードをクリックで追加 / 解除できます。
          </p>
          <button id="btn-finish-group-add" class="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 hover:scale-105 cursor-pointer">
            <span>✓</span>
            <span>選択完了</span>
          </button>
        </div>
      `;

      const finishBtn = this.groupNavigatorOverlay.querySelector('#btn-finish-group-add');
      if (finishBtn) {
        finishBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.addingToGroup = null;
          this.addingToGroupColor = null;
          this.render();
        });
      }
      return;
    }

    // 2. 通常表示（フレーム一覧 ＆ グループ一覧）
    let html = `
      <div class="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-2 shadow-lg flex flex-col gap-2 select-none min-w-[140px]">
    `;

    // 🖼️ フレーム一覧
    if (frameList.length > 0) {
      html += `
        <div class="flex flex-col gap-1">
          <div class="text-[10px] font-bold text-slate-500 px-1 flex items-center gap-1">
            <span>🖼️</span>
            <span>フレーム一覧</span>
          </div>
          <div class="flex flex-col gap-1">
      `;
      frameList.forEach(frame => {
        const dot = dotColorMap[frame.color] || dotColorMap.blue;
        const safeTitle = escapeHtml(frame.title);
        const insideCount = this.state.getNodesInFrame(frame.id).length;
        html += `
          <button class="frame-nav-btn flex items-center justify-between gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-300 rounded-xl transition-all text-left shadow-2xs hover:scale-[1.02] cursor-pointer"
                  data-frame-id="${frame.id}" title="クリックで「${safeTitle}」フレームにズーム">
            <span class="flex items-center gap-1.5 truncate max-w-[105px]">
              <span class="w-2 h-2 rounded-full shrink-0 ${dot}"></span>
              <span class="truncate">${safeTitle}</span>
            </span>
            <span class="text-[10px] px-1.5 py-0.2 bg-white rounded-md text-slate-500 font-mono shrink-0 shadow-2xs">${insideCount}</span>
          </button>
        `;
      });
      html += `
          </div>
        </div>
      `;
    }

    // 📂 グループ一覧
    if (groups.length > 0) {
      html += `
        <div class="flex flex-col gap-1 ${frameList.length > 0 ? 'border-t border-slate-100 pt-1.5' : ''}">
          <div class="text-[10px] font-bold text-slate-500 px-1 flex items-center gap-1">
            <span>📂</span>
            <span>グループ一覧</span>
          </div>
          <div class="flex flex-col gap-1 overflow-visible pr-0.5">
      `;
      groups.forEach((g, idx) => {
        const dot = dotColorMap[g.color] || dotColorMap.default;
        const safeName = escapeHtml(g.name);
        html += `
          <div class="flex items-center gap-1 w-full relative group-row">
            <button class="group-nav-btn flex-1 flex items-center justify-between gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-300 rounded-xl transition-all text-left shadow-2xs hover:scale-[1.02] cursor-pointer"
                    data-group="${safeName}" title="クリックで「${safeName}」グループ全体にズーム＆ジャンプ">
              <span class="flex items-center gap-1.5 truncate max-w-[105px]">
                <span class="w-2 h-2 rounded-full shrink-0 ${dot}"></span>
                <span class="truncate">${safeName}</span>
              </span>
              <span class="text-[10px] px-1.5 py-0.2 bg-white rounded-md text-slate-500 font-mono shrink-0 shadow-2xs">${g.count}</span>
            </button>
            
            <!-- 3点リーダーボタン -->
            <div class="relative">
              <button class="group-more-btn w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                      title="オプション" data-index="${idx}">
                ⋯
              </button>
              <!-- ドロップダウンメニュー -->
              <div id="group-menu-${idx}" class="group-dropdown-menu absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-xl p-1 z-50 hidden flex-col gap-0.5">
                <button class="btn-include-nodes px-2 py-1.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 rounded-lg text-left flex items-center gap-1.5 w-full transition-colors cursor-pointer"
                        data-group="${safeName}" data-color="${g.color}">
                  <span>＋</span>
                  <span>他のノードも含める</span>
                </button>
              </div>
            </div>
          </div>
        `;
      });
      html += `
          </div>
        </div>
      `;
    }

    html += `
      </div>
    `;

    this.groupNavigatorOverlay.innerHTML = html;

    // フレームジャンプのイベント
    this.groupNavigatorOverlay.querySelectorAll('.frame-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fId = btn.getAttribute('data-frame-id');
        this.focusFrame(fId);
      });
    });

    // グループジャンプのイベント
    this.groupNavigatorOverlay.querySelectorAll('.group-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gName = btn.getAttribute('data-group');
        this.focusGroup(gName);
      });
    });

    // 3点リーダーメニューのトグル
    this.groupNavigatorOverlay.querySelectorAll('.group-more-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = btn.getAttribute('data-index');
        const menu = document.getElementById(`group-menu-${idx}`);
        // 他の開いているメニューを閉じる
        this.groupNavigatorOverlay.querySelectorAll('.group-dropdown-menu').forEach(m => {
          if (m !== menu) m.classList.add('hidden');
        });
        if (menu) menu.classList.toggle('hidden');
      });
    });

    // 「他のノードも含める」ボタンのクリック
    this.groupNavigatorOverlay.querySelectorAll('.btn-include-nodes').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gName = btn.getAttribute('data-group');
        const gColor = btn.getAttribute('data-color') || 'default';
        this.addingToGroup = gName;
        this.addingToGroupColor = gColor;
        this.render();
      });
    });

    // メニュー外クリックで閉じる
    const closeMenus = () => {
      if (this.groupNavigatorOverlay) {
        this.groupNavigatorOverlay.querySelectorAll('.group-dropdown-menu').forEach(m => m.classList.add('hidden'));
      }
    };
    window.removeEventListener('click', this._boundCloseMenus || (() => {}));
    this._boundCloseMenus = closeMenus;
    window.addEventListener('click', closeMenus);
  }

  resetView() {
    this.panX = 80;
    this.panY = this.container.clientHeight / 2 - 35;
    this.scale = 1.0;
    this.applyTransform();
  }

  zoomIn() {
    this.scale = Math.min(this.scale * 1.2, 2.5);
    this.applyTransform();
  }

  zoomOut() {
    this.scale = Math.max(this.scale / 1.2, 0.35);
    this.applyTransform();
  }

  /**
   * 🗺️ 画面座標（コンテナ基準のピクセル）をキャンバスのワールド座標に変換
   * @param {number} screenX 
   * @param {number} screenY 
   * @returns {{x: number, y: number}}
   */
  screenToWorld(screenX, screenY) {
    return {
      x: Math.round((screenX - this.panX) / this.scale),
      y: Math.round((screenY - this.panY) / this.scale)
    };
  }

  /**
   * 🗺️ ワールド座標を画面座標（コンテナ基準のピクセル）に変換
   * @param {number} worldX 
   * @param {number} worldY 
   * @returns {{x: number, y: number}}
   */
  worldToScreen(worldX, worldY) {
    return {
      x: Math.round(worldX * this.scale + this.panX),
      y: Math.round(worldY * this.scale + this.panY)
    };
  }
}

window.MindMapTreeCanvas = MindMapTreeCanvas;
