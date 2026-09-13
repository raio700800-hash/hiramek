/**
 * =============================================================================
 * 🧠 状態管理モジュール (state.js)
 * =============================================================================
 * マインドマップのノード情報、チャット履歴、カスタムタグ、思考タイムマシンを管理します。
 */

/**
 * 🧹 タイトルの重複接頭辞・装飾を徹底クリーンアップする共通関数
 * - 「視点: 」「解決策: 」「工夫点: 」「検証タスク: 」「アプローチ: 」「初心者: 」等の接頭辞を除去
 * - 全角・半角コロン（:、：）や前後のスペースに対応
 * - カッコ囲み（【視点】、[解決策]、(工夫点)）に対応
 * - 先頭の絵文字や記号を綺麗に除去し、純粋な要約テキスト（本質）のみを抽出
 */
function cleanNodeTitle(rawTitle) {
  if (!rawTitle) return '';
  let title = String(rawTitle).trim();

  let prev = '';
  while (prev !== title) {
    prev = title;

    // 1. 先頭の絵文字や装飾記号を除去
    title = title.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}💡📋⚠️🎯✨👁️🔧📌❓📚⭕🚀🌟🌱🌿🧪]\s*/u, '');

    // 2. 接頭辞ワード + コロン（半角/全角）を除去
    title = title.replace(/^(視点|解決策|工夫点|検証タスク|検証|アクション|アプローチ|仕組み|答え|回答|必須|推奨|懸念|総括|原点|動機|Step\s*\d+|初心者|実践者|整理派|機能|要件)\s*[:：]\s*/i, '');

    // 3. カッコ囲みの接頭辞を除去
    title = title.replace(/^(\[|【|（|\()(視点|解決策|工夫点|検証タスク|検証|アクション|アプローチ|仕組み|答え|回答|必須|推奨|懸念|総括|原点|動機|初心者|実践者|整理派|機能|要件)(\]|】|）|\))\s*/i, '');

    title = title.trim();
  }

  return title || rawTitle;
}

if (typeof window !== 'undefined') {
  window.cleanNodeTitle = cleanNodeTitle;
}

const STORAGE_KEY = 'colocos_mindmap_state_v4';

class MindMapState {
  constructor() {
    this.listeners = [];
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 30;
    this.leftPaneCollapsed = false;

    this.loadState();
  }

  getDefaultState(customTitle = '新しい思考テーマ') {
    const rootId = 'root-1';
    return {
      selectedNodeId: rootId,
      // ユーザーが自由に作れるカスタムタグ一覧
      customTags: [
        { id: 'tag-important', name: '重要', color: 'rose' },
        { id: 'tag-idea', name: 'ミル造案', color: 'amber' },
        { id: 'tag-check', name: 'あとで確認', color: 'blue' }
      ],
      // 🖼️ 独立した大枠フレーム群（Miro風フレーム）
      frames: {},
      nodes: {
        [rootId]: {
          id: rootId,
          parentId: null,
          title: cleanNodeTitle(customTitle),
          content: 'このテーマについてAIと壁打ちしながらアイデアを深掘りしていきましょう！',
          status: 'None',      // None, Adopted (採用), InReview (要検討), Rejected (却下), Done (完了), Priority (最優先)
          nodeType: 'Goal',    // Goal, Idea, Task, Problem, Fact, Question, Inspiration, Reference
          tags: ['tag-important'], // 付与されたカスタムタグIDのリスト
          source: 'user',
          roleTag: 'Goal',
          originPrompt: `「${customTitle}」のテーマから開始`,
          aiLock: false,
          color: 'default',
          group: '',
          x: 80,
          y: 200,
          createdAt: new Date().toISOString()
        }
      },
      messages: [
        {
          id: 'msg-init-1',
          sender: 'ai',
          text: `「${customTitle}」について思考整理をスタートしました！\n左下の入力欄から質問や相談を入力するか、ノードの「広げる・深掘る」ボタンを押してアイデアを広げていきましょう。`,
          linkedNodeIds: [rootId],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ],
      settings: {
        geminiApiKey: '',
        geminiModel: 'gemini-3.6-flash',
        theme: 'whiteboard', // 'whiteboard' (ホワイトボードモード) または 'chalkboard' (黒板モード)
        layoutMode: 'radial-tree' // 'radial-tree', 'horizontal-tree', 'freeform'
      }
    };
  }

  recordHistory() {
    const snapshot = JSON.stringify({
      nodes: this.data.nodes,
      selectedNodeId: this.data.selectedNodeId,
      customTags: this.data.customTags,
      frames: this.data.frames
    });
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return false;

    const currentSnapshot = JSON.stringify({
      nodes: this.data.nodes,
      selectedNodeId: this.data.selectedNodeId,
      customTags: this.data.customTags,
      frames: this.data.frames
    });
    this.redoStack.push(currentSnapshot);

    const previousSnapshot = this.undoStack.pop();
    const restored = JSON.parse(previousSnapshot);
    this.data.nodes = restored.nodes;
    this.data.selectedNodeId = restored.selectedNodeId;
    if (restored.customTags) this.data.customTags = restored.customTags;
    if (restored.frames) this.data.frames = restored.frames;

    this.saveState();
    this.notify('undo');
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;

    const currentSnapshot = JSON.stringify({
      nodes: this.data.nodes,
      selectedNodeId: this.data.selectedNodeId,
      customTags: this.data.customTags,
      frames: this.data.frames
    });
    this.undoStack.push(currentSnapshot);

    const nextSnapshot = this.redoStack.pop();
    const restored = JSON.parse(nextSnapshot);
    this.data.nodes = restored.nodes;
    this.data.selectedNodeId = restored.selectedNodeId;
    if (restored.customTags) this.data.customTags = restored.customTags;
    if (restored.frames) this.data.frames = restored.frames;

    this.saveState();
    this.notify('redo');
    return true;
  }

  startNewTopic(topicTitle) {
    this.recordHistory();
    this.data = this.getDefaultState(topicTitle || '新しい思考テーマ');
    this.saveState();
    this.notify('new_topic_started');
  }

  addNode(parentId, title, content = '', nodeType = 'Idea', status = 'None', source = 'user', originPrompt = '', roleTag = 'None', color = 'default', group = '') {
    this.recordHistory();

    const parent = this.data.nodes[parentId];
    const newId = 'node-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    const posX = parent ? (parent.x || 100) + 320 : 200;
    const posY = parent ? (parent.y || 100) + 60 : 200;

    // 接頭辞（「視点:」「解決策:」等）を除去した純粋要約タイトルを保存
    const sanitizedTitle = cleanNodeTitle(title) || '新規ノード';

    this.data.nodes[newId] = {
      id: newId,
      parentId: parentId || null,
      title: sanitizedTitle,
      content: content,
      status: status,
      nodeType: nodeType,
      roleTag: roleTag || 'None',
      color: color || 'default',
      group: (group || '').trim(),
      tags: [],
      source: source,
      originPrompt: originPrompt || (source === 'user' ? '手動追加' : ''),
      aiLock: false,
      x: posX,
      y: posY,
      createdAt: new Date().toISOString()
    };

    this.data.selectedNodeId = newId;
    this.saveState();
    this.notify('node_added', { nodeId: newId });
    return newId;
  }

  addBatchNodes(parentId, nodeItems, source = 'ai', originPrompt = '') {
    if (!nodeItems || nodeItems.length === 0) return [];
    this.recordHistory();

    const parent = this.data.nodes[parentId] || { x: 100, y: 200 };
    const baseX = (parent.x || 100) + 320;
    const totalCount = nodeItems.length;
    const verticalGap = 84;
    const verticalSpan = Math.max((totalCount - 1) * verticalGap, 0);
    const startY = (parent.y || 200) - (verticalSpan / 2);

    const addedIds = [];
    nodeItems.forEach((item, index) => {
      const newId = 'node-' + Date.now() + '-' + index + '-' + Math.random().toString(36).substring(2, 6);
      const sanitizedTitle = cleanNodeTitle(item.title) || '提案ノード';

      this.data.nodes[newId] = {
        id: newId,
        parentId: parentId || this.data.selectedNodeId || 'root-1',
        title: sanitizedTitle,
        content: item.content || '',
        status: item.status || 'None',
        nodeType: item.nodeType || 'Idea',
        roleTag: item.roleTag || 'None',
        color: item.color || 'default',
        group: (item.group || '').trim(),
        tags: [],
        source: source,
        originPrompt: item.originPrompt || originPrompt || '',
        aiLock: false,
        x: baseX,
        y: startY + (index * verticalGap),
        createdAt: new Date().toISOString()
      };
      addedIds.push(newId);
    });

    this.saveState();
    this.notify('batch_nodes_added', { nodeIds: addedIds, parentId });
    return addedIds;
  }

  moveNodePosition(nodeId, x, y, recordUndo = true) {
    if (!this.data.nodes[nodeId]) return;
    if (recordUndo) this.recordHistory();
    this.data.nodes[nodeId].x = x;
    this.data.nodes[nodeId].y = y;
    this.saveState();
    this.notify('node_moved', { nodeId, x, y });
  }

  deleteNode(nodeId) {
    if (!this.data.nodes[nodeId]) return false;
    if (!this.data.nodes[nodeId].parentId) {
      alert('中心となる親ノード（題材）は削除できません。題材を変えたい場合は「新しい題材を始める」を押してください。');
      return false;
    }

    this.recordHistory();

    const toDelete = new Set();
    const collectDescendants = (id) => {
      toDelete.add(id);
      Object.values(this.data.nodes).forEach(n => {
        if (n.parentId === id) collectDescendants(n.id);
      });
    };
    collectDescendants(nodeId);

    toDelete.forEach(id => delete this.data.nodes[id]);

    if (toDelete.has(this.data.selectedNodeId)) {
      this.data.selectedNodeId = Object.keys(this.data.nodes)[0] || null;
    }

    this.saveState();
    this.notify('node_deleted', { deletedIds: Array.from(toDelete) });
    return true;
  }

  updateNode(nodeId, updates) {
    if (!this.data.nodes[nodeId]) return false;
    this.recordHistory();

    const processedUpdates = { ...updates };
    if (processedUpdates.title !== undefined) {
      processedUpdates.title = cleanNodeTitle(processedUpdates.title) || 'ノード';
    }

    this.data.nodes[nodeId] = {
      ...this.data.nodes[nodeId],
      ...processedUpdates
    };
    this.saveState();
    this.notify('node_updated', { nodeId });
    return true;
  }

  /**
   * 📂 未使用の連番グループ名（グループ1、グループ2…）を自動算出
   */
  getNextDefaultGroupName() {
    const existingGroups = new Set(
      Object.values(this.data.nodes || {})
        .map(n => (n.group || '').trim())
        .filter(g => g.length > 0)
    );

    let counter = 1;
    while (existingGroups.has(`グループ${counter}`)) {
      counter++;
    }
    return `グループ${counter}`;
  }

  /**
   * 📦 複数ノードに一括でグループ名とお好みの色を設定（アンドゥ1回分として記録）
   */
  setGroupForNodes(nodeIds, groupName, color = null) {
    if (!nodeIds || nodeIds.length === 0) return false;
    this.recordHistory();

    const cleanGroup = (groupName || '').trim();
    let updatedCount = 0;

    nodeIds.forEach(id => {
      const node = this.data.nodes[id];
      if (node) {
        node.group = cleanGroup;
        if (color) {
          node.color = color;
        }
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      this.saveState();
      this.notify('nodes_grouped', { nodeIds, group: cleanGroup, color });
      return true;
    }
    return false;
  }

  /**
   * 🎯 単一ノードのグループ所属をトグル（入っていれば解除、未所属なら追加）
   */
  toggleNodeGroup(nodeId, groupName, color = null) {
    const node = this.data.nodes[nodeId];
    if (!node) return false;
    this.recordHistory();

    const targetGroup = (groupName || '').trim();
    const isAlreadyMember = (node.group || '').trim() === targetGroup;

    if (isAlreadyMember) {
      node.group = ''; // 解除
    } else {
      node.group = targetGroup; // 追加
      if (color) {
        node.color = color;
      }
    }

    this.saveState();
    this.notify('node_updated', { nodeId });
    return true;
  }

  /**
   * 🖼️ グループに属する全ノードをまとめて移動（Miroフレームのドラッグ移動対応）
   * - 複数ノードの座標を一括更新し、1度のアンドゥ履歴としてアトミックに記録
   */
  moveGroupNodes(groupName, deltaX, deltaY, recordHistory = true) {
    const cleanGroup = (groupName || '').trim();
    if (!cleanGroup) return false;

    const groupNodes = Object.values(this.data.nodes).filter(
      n => (n.group || '').trim() === cleanGroup
    );
    if (groupNodes.length === 0) return false;

    if (recordHistory) {
      this.recordHistory();
    }

    groupNodes.forEach(n => {
      n.x = Math.round((n.x || 0) + deltaX);
      n.y = Math.round((n.y || 0) + deltaY);
    });

    this.saveState();
    this.notify('group_nodes_moved', { group: cleanGroup, deltaX, deltaY });
    return true;
  }

  /**
   * 📐 レイアウトモードの切り替え設定
   */
  setLayoutMode(layoutMode) {
    if (!['radial-tree', 'horizontal-tree', 'freeform'].includes(layoutMode)) return;
    if (!this.data.settings) this.data.settings = {};
    this.data.settings.layoutMode = layoutMode;
    this.saveState();
    this.notify('layout_mode_changed', { layoutMode });
  }

  // ===========================================================================
  // 🖼️ 独立フレーム機能（大枠グループ・リサイズ・ノード連動移動・衝突回避）
  // ===========================================================================

  /**
   * 🖼️ フレームの新規作成
   * @param {string} title フレーム名
   * @param {string} color カラー ('blue', 'green', 'amber', 'purple', 'rose', 'orange')
   * @param {number} x 左上X座標
   * @param {number} y 左上Y座標
   * @param {number} width 幅
   * @param {number} height 高さ
   * @param {string[]} nodeIds 包摂するノードIDリスト（指定時は自動で領域計算）
   */
  createFrame(title = '新規フレーム', color = 'blue', x = 0, y = 0, width = 360, height = 240, nodeIds = []) {
    this.recordHistory();
    const frameId = 'frame-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    let frameTitle = '新規フレーム';
    let frameColor = 'blue';
    let posX = 0;
    let posY = 0;
    let fWidth = 360;
    let fHeight = 240;
    let targetNodeIds = [];

    // オブジェクト渡し（{ title, color, x, y, width, height, nodeIds }）と個別引数の両方に対応
    if (typeof title === 'object' && title !== null) {
      const opts = title;
      frameTitle = opts.title || '新規フレーム';
      frameColor = opts.color || 'blue';
      posX = opts.x !== undefined ? opts.x : 0;
      posY = opts.y !== undefined ? opts.y : 0;
      fWidth = opts.width !== undefined ? opts.width : 360;
      fHeight = opts.height !== undefined ? opts.height : 240;
      targetNodeIds = opts.nodeIds || [];
    } else {
      frameTitle = title || '新規フレーム';
      frameColor = color || 'blue';
      posX = x !== undefined ? x : 0;
      posY = y !== undefined ? y : 0;
      fWidth = width !== undefined ? width : 360;
      fHeight = height !== undefined ? height : 240;
      targetNodeIds = nodeIds || [];
    }

    if (targetNodeIds && targetNodeIds.length > 0) {
      const validNodes = targetNodeIds.map(id => this.data.nodes[id]).filter(Boolean);
      if (validNodes.length > 0) {
        const padding = 36;
        const minX = Math.min(...validNodes.map(n => n.x || 0));
        const maxX = Math.max(...validNodes.map(n => (n.x || 0) + 260));
        const minY = Math.min(...validNodes.map(n => n.y || 0));
        const maxY = Math.max(...validNodes.map(n => (n.y || 0) + 70));

        posX = minX - padding;
        posY = minY - padding - 40;
        fWidth = Math.max((maxX - minX) + (padding * 2), 280);
        fHeight = Math.max((maxY - minY) + (padding * 2) + 40, 180);
      }
    }

    if (!this.data.frames) this.data.frames = {};

    const newFrame = {
      id: frameId,
      title: String(frameTitle || 'フレーム').trim(),
      color: frameColor || 'blue',
      x: Math.round(posX),
      y: Math.round(posY),
      width: Math.round(fWidth),
      height: Math.round(fHeight),
      createdAt: new Date().toISOString()
    };
    this.data.frames[frameId] = newFrame;

    this.saveState();
    this.notify('frame_created', { frameId });
    return newFrame;
  }

  /**
   * 🖼️ フレームの更新（タイトル、色、サイズ、座標）
   */
  updateFrame(frameId, updates) {
    if (!this.data.frames) return false;
    const frame = this.data.frames[frameId];
    if (!frame) return false;

    this.recordHistory();
    if (updates.title !== undefined) frame.title = (updates.title || 'フレーム').trim();
    if (updates.color !== undefined) frame.color = updates.color;
    if (updates.x !== undefined) frame.x = Math.round(updates.x);
    if (updates.y !== undefined) frame.y = Math.round(updates.y);
    if (updates.width !== undefined) frame.width = Math.max(Math.round(updates.width), 160);
    if (updates.height !== undefined) frame.height = Math.max(Math.round(updates.height), 120);

    this.saveState();
    this.notify('frame_updated', { frameId });
    return true;
  }

  /**
   * 🖼️ フレームの削除（deleteNodesがtrueなら枠内ノードも削除、falseならフレーム枠のみ解除）
   */
  deleteFrame(frameId, deleteNodes = false) {
    if (!this.data.frames) return false;
    const frame = this.data.frames[frameId];
    if (!frame) return false;

    this.recordHistory();
    if (deleteNodes) {
      const nodesInside = this.getNodesInFrame(frameId);
      nodesInside.forEach(node => {
        delete this.data.nodes[node.id];
      });
      if (!this.data.nodes[this.data.selectedNodeId]) {
        const remaining = Object.keys(this.data.nodes);
        this.data.selectedNodeId = remaining.length > 0 ? remaining[0] : null;
      }
    }

    delete this.data.frames[frameId];
    this.saveState();
    this.notify('frame_deleted', { frameId, deleteNodes });
    return true;
  }

  /**
   * 🖼️ フレーム内に入っているノードを自動判定
   */
  getNodesInFrame(frameId) {
    if (!this.data.frames) return [];
    const frame = this.data.frames[frameId];
    if (!frame) return [];

    const fLeft = frame.x;
    const fRight = frame.x + frame.width;
    const fTop = frame.y;
    const fBottom = frame.y + frame.height;

    return Object.values(this.data.nodes).filter(n => {
      const nx = n.x || 0;
      const ny = n.y || 0;
      const centerX = nx + 130;
      const centerY = ny + 35;
      return centerX >= fLeft && centerX <= fRight && centerY >= fTop && centerY <= fBottom;
    });
  }

  /**
   * 🖼️ フレームおよび枠内ノードの一括移動
   */
  moveFrame(frameId, deltaX, deltaY, recordHistory = true) {
    if (!this.data.frames) return false;
    const frame = this.data.frames[frameId];
    if (!frame) return false;

    if (recordHistory) {
      this.recordHistory();
    }

    const dX = Math.round(deltaX);
    const dY = Math.round(deltaY);

    const insideNodes = this.getNodesInFrame(frameId);
    insideNodes.forEach(node => {
      node.x = Math.round((node.x || 0) + dX);
      node.y = Math.round((node.y || 0) + dY);
    });

    frame.x = Math.round(frame.x + dX);
    frame.y = Math.round(frame.y + dY);

    this.saveState();
    this.notify('frame_moved', { frameId, deltaX: dX, deltaY: dY });
    return true;
  }

  /**
   * 🖼️ フレームのリサイズ（四隅ハンドルドラッグ）
   */
  resizeFrame(frameId, newWidth, newHeight, newX = null, newY = null, recordHistory = true) {
    if (!this.data.frames) return false;
    const frame = this.data.frames[frameId];
    if (!frame) return false;

    if (recordHistory) {
      this.recordHistory();
    }

    frame.width = Math.max(Math.round(newWidth), 180);
    frame.height = Math.max(Math.round(newHeight), 130);
    if (newX !== null) frame.x = Math.round(newX);
    if (newY !== null) frame.y = Math.round(newY);

    this.saveState();
    this.notify('frame_resized', { frameId });
    return true;
  }

  /**
   * 🖼️ フレームを中のノード群にぴったりフィットさせる
   */
  fitFrameToNodes(frameId) {
    if (!this.data.frames) return false;
    const frame = this.data.frames[frameId];
    if (!frame) return false;

    const insideNodes = this.getNodesInFrame(frameId);
    if (insideNodes.length === 0) return false;

    this.recordHistory();
    const padding = 36;
    const minX = Math.min(...insideNodes.map(n => n.x || 0));
    const maxX = Math.max(...insideNodes.map(n => (n.x || 0) + 260));
    const minY = Math.min(...insideNodes.map(n => n.y || 0));
    const maxY = Math.max(...insideNodes.map(n => (n.y || 0) + 70));

    frame.x = Math.round(minX - padding);
    frame.y = Math.round(minY - padding - 40);
    frame.width = Math.max(Math.round((maxX - minX) + (padding * 2)), 240);
    frame.height = Math.max(Math.round((maxY - minY) + (padding * 2) + 40), 160);

    this.saveState();
    this.notify('frame_updated', { frameId });
    return true;
  }

  /**
   * ☀️/🌙 テーマの切り替え（'whiteboard' または 'chalkboard'）
   */
  setTheme(theme) {
    if (theme !== 'whiteboard' && theme !== 'chalkboard') return;
    if (!this.data.settings) this.data.settings = {};
    this.data.settings.theme = theme;
    this.saveState();
    this.notify('theme_changed', { theme });
  }

  /**
   * ユーザー作成のカスタムタグを追加
   */
  createCustomTag(name, color = 'blue') {
    if (!name || !name.trim()) return null;
    this.recordHistory();

    const newTag = {
      id: 'tag-' + Date.now(),
      name: name.trim(),
      color: color
    };

    if (!this.data.customTags) this.data.customTags = [];
    this.data.customTags.push(newTag);

    this.saveState();
    this.notify('custom_tag_created', { tag: newTag });
    return newTag;
  }

  /**
   * ノードにタグを付け外し（トグル）
   */
  toggleNodeTag(nodeId, tagId) {
    const node = this.data.nodes[nodeId];
    if (!node) return;

    this.recordHistory();
    if (!node.tags) node.tags = [];

    const idx = node.tags.indexOf(tagId);
    if (idx >= 0) {
      node.tags.splice(idx, 1); // 削除
    } else {
      node.tags.push(tagId); // 追加
    }

    this.saveState();
    this.notify('node_tags_updated', { nodeId, tags: node.tags });
  }

  selectNode(nodeId) {
    if (this.data.nodes[nodeId] && this.data.selectedNodeId !== nodeId) {
      this.data.selectedNodeId = nodeId;
      this.notify('node_selected', { nodeId });
    }
  }

  addMessage(sender, text, linkedNodeIds = []) {
    const msg = {
      id: 'msg-' + Date.now(),
      sender: sender,
      text: text,
      linkedNodeIds: Array.isArray(linkedNodeIds) ? linkedNodeIds : (linkedNodeIds ? [linkedNodeIds] : []),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.data.messages.push(msg);
    this.saveState();
    this.notify('message_added', { message: msg });
    return msg;
  }

  updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.saveState();
    this.notify('settings_updated');
  }

  subscribe(callback) {
    this.listeners.push(callback);
  }

  notify(eventType, payload = {}) {
    this.listeners.forEach(cb => {
      try {
        cb(eventType, payload, this.data);
      } catch (e) {
        console.error('リスナーエラー:', e);
      }
    });
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('LocalStorage 保存エラー:', e);
    }
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.data = JSON.parse(saved);
        if (!this.data.nodes || Object.keys(this.data.nodes).length === 0) {
          this.data = this.getDefaultState();
        }
      } else {
        this.data = this.getDefaultState();
      }
    } catch (e) {
      this.data = this.getDefaultState();
    }

    // 🌟 既存データの自動マイグレーション（接頭辞の重複除去＆color/group＆設定初期化）
    let stateChanged = false;
    if (this.data && this.data.nodes) {
      Object.values(this.data.nodes).forEach(n => {
        if (n.title) {
          const cleaned = cleanNodeTitle(n.title);
          if (cleaned !== n.title) {
            n.title = cleaned;
            stateChanged = true;
          }
        }
        if (!n.color) {
          n.color = 'default';
          stateChanged = true;
        }
        if (n.group === undefined) {
          n.group = '';
          stateChanged = true;
        }
      });
    }
    if (!this.data.frames) {
      this.data.frames = {};
      stateChanged = true;
    }
    if (!this.data.settings) {
      this.data.settings = { geminiApiKey: '', geminiModel: 'gemini-3.6-flash', theme: 'whiteboard', layoutMode: 'radial-tree' };
      stateChanged = true;
    } else {
      if (!this.data.settings.geminiModel) {
        this.data.settings.geminiModel = 'gemini-3.6-flash';
        stateChanged = true;
      }
      if (!this.data.settings.layoutMode) {
        this.data.settings.layoutMode = 'radial-tree';
        stateChanged = true;
      }
      if (!this.data.settings.theme || (this.data.settings.theme !== 'whiteboard' && this.data.settings.theme !== 'chalkboard')) {
        this.data.settings.theme = 'whiteboard';
        stateChanged = true;
      }
    }
    if (stateChanged) {
      this.saveState();
    }
  }
}

if (typeof window !== 'undefined') {
  window.mindMapState = new MindMapState();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MindMapState, cleanNodeTitle };
}
