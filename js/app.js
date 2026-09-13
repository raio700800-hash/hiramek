/**
 * =============================================================================
 * 🚀 アプリ統合コントローラー (app.js)
 * =============================================================================
 * 左側のチャット・エディタと、右側のノードツリーキャンバスを
 * リアルタイムに双方向同期させ、ミル造さんの操作を快適にナビゲートします。
 */

document.addEventListener('DOMContentLoaded', () => {
  const state = window.mindMapState;

  // 🛡️ XSS防止用HTMLエスケープ関数
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 左ペイン要素
  const leftSidebar = document.getElementById('left-sidebar');
  const btnCollapseSidebar = document.getElementById('btn-collapse-sidebar');
  const btnExpandSidebar = document.getElementById('btn-expand-sidebar');

  // チャット・エディタ要素
  const chatMessagesElm = document.getElementById('chat-messages');
  const promptInput = document.getElementById('prompt-input');
  const sendPromptBtn = document.getElementById('send-prompt-btn');

  // ノード誕生きっかけバッジ要素
  const nodeOriginCard = document.getElementById('node-origin-card');
  const nodeOriginText = document.getElementById('node-origin-text');

  const editorNodeTitle = document.getElementById('editor-node-title');
  const editorNodeContent = document.getElementById('editor-node-content');
  const editorNodeStatus = document.getElementById('editor-node-status');
  const editorNodeType = document.getElementById('editor-node-type');
  const editorNodeRole = document.getElementById('editor-node-role');
  const editorDeleteBtn = document.getElementById('editor-delete-btn');
  const editorAddChildBtn = document.getElementById('editor-add-child-btn');

  // ノード色分け & グループ分け要素
  const editorNodeGroup = document.getElementById('editor-node-group');
  const nodeColorPalette = document.getElementById('node-color-palette');
  const colorButtons = nodeColorPalette ? nodeColorPalette.querySelectorAll('.color-btn') : [];

  // カスタムタグ要素
  const btnCreateTag = document.getElementById('btn-create-tag');
  const customTagsContainer = document.getElementById('custom-tags-container');

  // 8大AI思考コマンドボタン
  const cmdExpandBtn = document.getElementById('cmd-expand-btn');
  const cmdDeepenBtn = document.getElementById('cmd-deepen-btn');
  const cmdAlternativeBtn = document.getElementById('cmd-alternative-btn');
  const cmdTaskifyBtn = document.getElementById('cmd-taskify-btn');
  const cmdExampleBtn = document.getElementById('cmd-example-btn');
  const cmdWhyBtn = document.getElementById('cmd-why-btn');
  const cmdProsconsBtn = document.getElementById('cmd-proscons-btn');
  const cmdSummarizeBtn = document.getElementById('cmd-summarize-btn');

  // ツールバー
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnFitView = document.getElementById('btn-fit-view');
  const btnTidy = document.getElementById('btn-tidy');
  const btnExport = document.getElementById('btn-export');
  const btnSettings = document.getElementById('btn-settings');
  const btnNewTopic = document.getElementById('btn-new-topic');
  const selectLayoutMode = document.getElementById('select-layout-mode');
  const btnAddFrame = document.getElementById('btn-add-frame');

  // ☀️/🌙 テーマ切替ボタン（ホワイトボード / 黒板）
  const btnToggleTheme = document.getElementById('btn-toggle-theme');
  const themeBtnIcon = document.getElementById('theme-btn-icon');
  const themeBtnText = document.getElementById('theme-btn-text');

  // 新規題材モーダル
  const newTopicModal = document.getElementById('new-topic-modal');
  const newTopicInput = document.getElementById('new-topic-input');
  const startTopicConfirmBtn = document.getElementById('start-topic-confirm-btn');
  const cancelTopicBtn = document.getElementById('cancel-topic-btn');
  const closeTopicModalBtn = document.getElementById('close-topic-modal-btn');

  // 子ノード追加モーダル（洗練された中央ダイアログ）
  const addNodeModal = document.getElementById('add-node-modal');
  const addNodeParentTitle = document.getElementById('add-node-parent-title');
  const addNodeTitleInput = document.getElementById('add-node-title-input');
  const addNodeTypeSelect = document.getElementById('add-node-type-select');
  const addNodeRoleSelect = document.getElementById('add-node-role-select');
  const addNodeContentInput = document.getElementById('add-node-content-input');
  const closeAddNodeBtn = document.getElementById('close-add-node-btn');
  const cancelAddNodeBtn = document.getElementById('cancel-add-node-btn');
  const confirmAddNodeBtn = document.getElementById('confirm-add-node-btn');
  let currentAddParentId = null;

  // 設定モーダル
  const settingsModal = document.getElementById('settings-modal');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const apiKeyInput = document.getElementById('gemini-api-key-input');
  const geminiModelSelect = document.getElementById('gemini-model-select');

  // 📦 複数選択フローティングバー & グループ作成モーダル
  const floatingMultiselectBar = document.getElementById('floating-multiselect-bar');
  const btnGroupSelectedNodes = document.getElementById('btn-group-selected-nodes');
  const btnClearMultiselect = document.getElementById('btn-clear-multiselect');
  const groupCreateModal = document.getElementById('group-create-modal');
  const closeGroupModalBtn = document.getElementById('close-group-modal-btn');
  const cancelGroupModalBtn = document.getElementById('cancel-group-modal-btn');
  const confirmGroupModalBtn = document.getElementById('confirm-group-modal-btn');
  const groupModalNameInput = document.getElementById('group-modal-name-input');
  const groupModalCountText = document.getElementById('group-modal-count-text');
  const groupModalColorBtns = document.querySelectorAll('#group-modal-color-palette .group-color-btn');
  let selectedGroupModalColor = 'blue';

  // 🖼️ 複数選択フレーム作成ボタン & フレーム作成モーダル
  const btnCreateFrameForNodes = document.getElementById('btn-create-frame-for-nodes');
  const frameCreateModal = document.getElementById('frame-create-modal');
  const closeFrameCreateModalBtn = document.getElementById('close-frame-create-modal-btn');
  const cancelFrameCreateModalBtn = document.getElementById('cancel-frame-create-modal-btn');
  const confirmFrameCreateModalBtn = document.getElementById('confirm-frame-create-modal-btn');
  const frameCreateTitleInput = document.getElementById('frame-create-title-input');
  const frameCreateColorBtns = document.querySelectorAll('#frame-create-color-palette .frame-create-color-btn');
  let selectedFrameCreateColor = 'blue';
  let targetNodesForNewFrame = [];

  // ✏️ フレーム編集モーダル
  const frameEditModal = document.getElementById('frame-edit-modal');
  const closeFrameEditModalBtn = document.getElementById('close-frame-edit-modal-btn');
  const cancelFrameEditModalBtn = document.getElementById('cancel-frame-edit-modal-btn');
  const saveFrameEditModalBtn = document.getElementById('save-frame-edit-modal-btn');
  const frameEditTitleInput = document.getElementById('frame-edit-title-input');
  const frameEditColorBtns = document.querySelectorAll('#frame-edit-color-palette .frame-edit-color-btn');
  const btnFrameFitNodes = document.getElementById('btn-frame-fit-nodes');
  const btnDeleteFrameOnly = document.getElementById('btn-delete-frame-only');
  const btnDeleteFrameWithNodes = document.getElementById('btn-delete-frame-with-nodes');
  let currentEditingFrameId = null;
  let selectedFrameEditColor = 'blue';

  // ===========================================================================
  // 🌿 洗練された子ノード追加モーダルの開閉ロジック
  // ===========================================================================
  function openAddNodeModal(parentId) {
    currentAddParentId = parentId;
    const parentNode = state.data.nodes[parentId];
    if (addNodeParentTitle) {
      addNodeParentTitle.textContent = parentNode ? parentNode.title : '選択中ノード';
    }
    if (addNodeTitleInput) addNodeTitleInput.value = '';
    if (addNodeContentInput) addNodeContentInput.value = '';
    if (addNodeTypeSelect) addNodeTypeSelect.value = 'Idea';
    if (addNodeRoleSelect) addNodeRoleSelect.value = 'None';

    if (addNodeModal) {
      addNodeModal.classList.remove('hidden');
      setTimeout(() => {
        if (addNodeTitleInput) addNodeTitleInput.focus();
      }, 100);
    }
  }

  function closeAddNodeModal() {
    if (addNodeModal) addNodeModal.classList.add('hidden');
    currentAddParentId = null;
  }

  function handleConfirmAddNode() {
    if (!currentAddParentId) {
      closeAddNodeModal();
      return;
    }
    const title = addNodeTitleInput ? addNodeTitleInput.value.trim() : '';
    if (!title) {
      alert('ノードのタイトルを入力してください。');
      if (addNodeTitleInput) addNodeTitleInput.focus();
      return;
    }
    const nodeType = addNodeTypeSelect ? addNodeTypeSelect.value : 'Idea';
    const roleTag = addNodeRoleSelect ? addNodeRoleSelect.value : 'None';
    const content = addNodeContentInput ? addNodeContentInput.value.trim() : '';

    state.addNode(currentAddParentId, title, content, nodeType, 'None', 'user', '手動追加', roleTag);
    closeAddNodeModal();
  }

  if (closeAddNodeBtn) closeAddNodeBtn.addEventListener('click', closeAddNodeModal);
  if (cancelAddNodeBtn) cancelAddNodeBtn.addEventListener('click', closeAddNodeModal);
  if (confirmAddNodeBtn) confirmAddNodeBtn.addEventListener('click', handleConfirmAddNode);

  if (addNodeTitleInput) {
    addNodeTitleInput.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirmAddNode();
      } else if (e.key === 'Escape') {
        closeAddNodeModal();
      }
    });
  }

  // ===========================================================================
  // 🌟 キャンバスの初期化（ノードの✏️編集ボタン・＋追加ボタン押下時のコールバック付き）
  // ===========================================================================
  const canvas = new window.MindMapTreeCanvas(
    'canvas-container', 
    state, 
    (nodeId) => {
      // ✏️ 編集ボタン: 畳まれていたら左エディタを即展開しタイトルにフォーカス！
      expandLeftSidebar();
      setTimeout(() => {
        if (editorNodeTitle) {
          editorNodeTitle.focus();
          editorNodeTitle.select();
        }
      }, 150);
    },
    (nodeId) => {
      // 🌿 ＋追加ボタン: 画面中央に洗練された追加モーダルを表示！
      openAddNodeModal(nodeId);
    },
    (frameId) => {
      // ✏️ フレーム編集ボタン: フレーム編集モーダルを表示！
      openFrameEditModal(frameId);
    }
  );

  // ===========================================================================
  // 📦 ワンタップ・グループ作成モーダル制御
  // ===========================================================================
  function openGroupCreateModal() {
    const nodeCount = canvas.selectedNodeIds.size;
    if (nodeCount < 1) return;

    if (groupModalCountText) {
      groupModalCountText.textContent = nodeCount;
    }

    // 自動で「グループ1」「グループ2」などをプレ入力
    const defaultGroupName = state.getNextDefaultGroupName();
    if (groupModalNameInput) {
      groupModalNameInput.value = defaultGroupName;
    }

    // カラーパレットの同期（デフォルトはblue）
    selectedGroupModalColor = 'blue';
    if (groupModalColorBtns && groupModalColorBtns.length > 0) {
      groupModalColorBtns.forEach(btn => {
        const isSelected = btn.dataset.color === selectedGroupModalColor;
        btn.classList.toggle('ring-2', isSelected);
        btn.classList.toggle('ring-indigo-500', isSelected);
        btn.classList.toggle('ring-offset-2', isSelected);
        btn.classList.toggle('scale-110', isSelected);
      });
    }

    if (groupCreateModal) {
      groupCreateModal.classList.remove('hidden');
      setTimeout(() => {
        if (groupModalNameInput) {
          groupModalNameInput.focus();
          groupModalNameInput.select();
        }
      }, 60);
    }
  }

  function closeGroupCreateModal() {
    if (groupCreateModal) {
      groupCreateModal.classList.add('hidden');
    }
  }

  function handleConfirmGroupCreate() {
    const nodeIds = Array.from(canvas.selectedNodeIds);
    if (nodeIds.length === 0) return;

    const typedName = groupModalNameInput ? groupModalNameInput.value.trim() : '';
    const finalName = typedName || state.getNextDefaultGroupName();

    state.setGroupForNodes(nodeIds, finalName, selectedGroupModalColor);
    canvas.clearMultiSelection();
    closeGroupCreateModal();
  }

  if (btnGroupSelectedNodes) btnGroupSelectedNodes.addEventListener('click', openGroupCreateModal);
  if (btnClearMultiselect) btnClearMultiselect.addEventListener('click', () => canvas.clearMultiSelection());
  if (closeGroupModalBtn) closeGroupModalBtn.addEventListener('click', closeGroupCreateModal);
  if (cancelGroupModalBtn) cancelGroupModalBtn.addEventListener('click', closeGroupCreateModal);
  if (confirmGroupModalBtn) confirmGroupModalBtn.addEventListener('click', handleConfirmGroupCreate);

  if (groupModalNameInput) {
    groupModalNameInput.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirmGroupCreate();
      } else if (e.key === 'Escape') {
        closeGroupCreateModal();
      }
    });
  }

  if (groupModalColorBtns && groupModalColorBtns.length > 0) {
    groupModalColorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        selectedGroupModalColor = btn.dataset.color || 'blue';
        groupModalColorBtns.forEach(b => {
          const isSelected = b.dataset.color === selectedGroupModalColor;
          b.classList.toggle('ring-2', isSelected);
          b.classList.toggle('ring-indigo-500', isSelected);
          b.classList.toggle('ring-offset-2', isSelected);
          b.classList.toggle('scale-110', isSelected);
        });
      });
    });
  }

  // ===========================================================================
  // ☀️/🌙 テーマ適用ロジック（ホワイトボード / 目に優しい黒板モード）
  // ===========================================================================
  /**
   * 指定したテーマ（'whiteboard' または 'chalkboard'）をアプリ全体に適用します。
   * 初心者の方でも長時間の思考で目が疲れないよう、黒板モードは目に優しい深緑とチョーク色に切り替わります。
   * @param {string} theme - 'whiteboard' | 'chalkboard'
   */
  function applyTheme(theme) {
    const isChalkboard = theme === 'chalkboard';
    document.body.classList.toggle('theme-chalkboard', isChalkboard);

    if (themeBtnIcon) {
      themeBtnIcon.textContent = isChalkboard ? '🌙' : '☀️';
    }
    if (themeBtnText) {
      themeBtnText.textContent = isChalkboard ? '黒板' : '白板';
    }
    if (btnToggleTheme) {
      btnToggleTheme.title = isChalkboard
        ? 'ホワイトボードモード（すっきり白基調）に切り替え'
        : '黒板モード（目に優しい学校の黒板調）に切り替え';
    }
  }

  if (btnToggleTheme) {
    btnToggleTheme.addEventListener('click', () => {
      const currentTheme = state.data.settings?.theme || 'whiteboard';
      const nextTheme = currentTheme === 'chalkboard' ? 'whiteboard' : 'chalkboard';
      state.setTheme(nextTheme);
      applyTheme(nextTheme);
    });
  }

  // ===========================================================================
  // 🖼️ フレーム新規作成モーダルのロジック
  // ===========================================================================
  /**
   * 未使用の「フレーム 1」「フレーム 2」等の連番タイトルを自動生成します。
   */
  function getNextDefaultFrameTitle() {
    const existingFrames = Object.values(state.data.frames || {});
    const existingTitles = new Set(existingFrames.map(f => f.title));
    let index = 1;
    while (existingTitles.has(`フレーム ${index}`)) {
      index++;
    }
    return `フレーム ${index}`;
  }

  /**
   * フレーム作成モーダルを開きます。
   * @param {string[]} nodeIds - 囲む対象のノードID一覧（空配列なら中央に空フレーム作成）
   */
  function openFrameCreateModal(nodeIds = []) {
    targetNodesForNewFrame = Array.isArray(nodeIds) ? [...nodeIds] : [];
    if (frameCreateTitleInput) {
      frameCreateTitleInput.value = getNextDefaultFrameTitle();
    }
    selectedFrameCreateColor = 'blue';
    if (frameCreateColorBtns) {
      frameCreateColorBtns.forEach(b => {
        const isSelected = (b.dataset.color || 'blue') === 'blue';
        b.classList.toggle('ring-2', isSelected);
        b.classList.toggle('ring-indigo-500', isSelected);
        b.classList.toggle('ring-offset-2', isSelected);
        b.classList.toggle('scale-110', isSelected);
      });
    }
    if (frameCreateModal) {
      frameCreateModal.classList.remove('hidden');
      if (frameCreateTitleInput) {
        setTimeout(() => {
          frameCreateTitleInput.focus();
          frameCreateTitleInput.select();
        }, 80);
      }
    }
  }

  function closeFrameCreateModal() {
    if (frameCreateModal) frameCreateModal.classList.add('hidden');
    targetNodesForNewFrame = [];
  }

  function handleConfirmFrameCreate() {
    const title = frameCreateTitleInput ? (frameCreateTitleInput.value.trim() || 'フレーム') : 'フレーム';
    const color = selectedFrameCreateColor || 'blue';

    if (targetNodesForNewFrame && targetNodesForNewFrame.length > 0) {
      // 複数ノードを囲むフレームを作成
      state.createFrame({
        title,
        color,
        nodeIds: targetNodesForNewFrame
      });
      canvas.clearMultiSelection();
    } else {
      // 画面中央に空のフレームを作成
      const containerRect = canvas.container.getBoundingClientRect();
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;
      const worldPos = canvas.screenToWorld(centerX, centerY);

      state.createFrame({
        title,
        color,
        x: Math.round(worldPos.x - 175),
        y: Math.round(worldPos.y - 125),
        width: 350,
        height: 250
      });
    }

    closeFrameCreateModal();
  }

  if (btnCreateFrameForNodes) {
    btnCreateFrameForNodes.addEventListener('click', () => {
      openFrameCreateModal(Array.from(canvas.selectedNodeIds));
    });
  }

  if (btnAddFrame) {
    btnAddFrame.addEventListener('click', () => {
      openFrameCreateModal([]);
    });
  }

  if (closeFrameCreateModalBtn) closeFrameCreateModalBtn.addEventListener('click', closeFrameCreateModal);
  if (cancelFrameCreateModalBtn) cancelFrameCreateModalBtn.addEventListener('click', closeFrameCreateModal);
  if (confirmFrameCreateModalBtn) confirmFrameCreateModalBtn.addEventListener('click', handleConfirmFrameCreate);

  if (frameCreateTitleInput) {
    frameCreateTitleInput.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirmFrameCreate();
      } else if (e.key === 'Escape') {
        closeFrameCreateModal();
      }
    });
  }

  if (frameCreateColorBtns && frameCreateColorBtns.length > 0) {
    frameCreateColorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        selectedFrameCreateColor = btn.dataset.color || 'blue';
        frameCreateColorBtns.forEach(b => {
          const isSelected = b.dataset.color === selectedFrameCreateColor;
          b.classList.toggle('ring-2', isSelected);
          b.classList.toggle('ring-indigo-500', isSelected);
          b.classList.toggle('ring-offset-2', isSelected);
          b.classList.toggle('scale-110', isSelected);
        });
      });
    });
  }

  // ===========================================================================
  // ✏️ フレーム編集モーダルのロジック（名前・色・自動フィット・削除）
  // ===========================================================================
  /**
   * 指定したフレームの編集モーダルを開きます。
   * @param {string} frameId 
   */
  function openFrameEditModal(frameId) {
    const frame = state.data.frames?.[frameId];
    if (!frame) return;

    currentEditingFrameId = frameId;
    selectedFrameEditColor = frame.color || 'blue';

    if (frameEditTitleInput) {
      frameEditTitleInput.value = frame.title || '';
    }

    if (frameEditColorBtns && frameEditColorBtns.length > 0) {
      frameEditColorBtns.forEach(btn => {
        const isSelected = btn.dataset.color === selectedFrameEditColor;
        btn.classList.toggle('ring-2', isSelected);
        btn.classList.toggle('ring-indigo-500', isSelected);
        btn.classList.toggle('ring-offset-2', isSelected);
        btn.classList.toggle('scale-110', isSelected);
      });
    }

    if (frameEditModal) {
      frameEditModal.classList.remove('hidden');
      if (frameEditTitleInput) {
        setTimeout(() => {
          frameEditTitleInput.focus();
          frameEditTitleInput.select();
        }, 80);
      }
    }
  }

  function closeFrameEditModal() {
    if (frameEditModal) frameEditModal.classList.add('hidden');
    currentEditingFrameId = null;
  }

  function handleSaveFrameEdit() {
    if (!currentEditingFrameId) return;
    const title = frameEditTitleInput ? (frameEditTitleInput.value.trim() || 'フレーム') : 'フレーム';
    const color = selectedFrameEditColor || 'blue';

    state.updateFrame(currentEditingFrameId, { title, color });
    closeFrameEditModal();
  }

  if (closeFrameEditModalBtn) closeFrameEditModalBtn.addEventListener('click', closeFrameEditModal);
  if (cancelFrameEditModalBtn) cancelFrameEditModalBtn.addEventListener('click', closeFrameEditModal);
  if (saveFrameEditModalBtn) saveFrameEditModalBtn.addEventListener('click', handleSaveFrameEdit);

  if (frameEditTitleInput) {
    frameEditTitleInput.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveFrameEdit();
      } else if (e.key === 'Escape') {
        closeFrameEditModal();
      }
    });
  }

  if (frameEditColorBtns && frameEditColorBtns.length > 0) {
    frameEditColorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        selectedFrameEditColor = btn.dataset.color || 'blue';
        frameEditColorBtns.forEach(b => {
          const isSelected = b.dataset.color === selectedFrameEditColor;
          b.classList.toggle('ring-2', isSelected);
          b.classList.toggle('ring-indigo-500', isSelected);
          b.classList.toggle('ring-offset-2', isSelected);
          b.classList.toggle('scale-110', isSelected);
        });
      });
    });
  }

  // 📐 枠内のノードに合わせて自動サイズ調整
  if (btnFrameFitNodes) {
    btnFrameFitNodes.addEventListener('click', () => {
      if (!currentEditingFrameId) return;
      state.fitFrameToNodes(currentEditingFrameId);
      closeFrameEditModal();
    });
  }

  // 🗑️ フレームのみ解除（ノードはキャンバスに残す）
  if (btnDeleteFrameOnly) {
    btnDeleteFrameOnly.addEventListener('click', () => {
      if (!currentEditingFrameId) return;
      state.deleteFrame(currentEditingFrameId, false);
      closeFrameEditModal();
    });
  }

  // 💥 ノードごと削除
  if (btnDeleteFrameWithNodes) {
    btnDeleteFrameWithNodes.addEventListener('click', () => {
      if (!currentEditingFrameId) return;
      const frame = state.data.frames?.[currentEditingFrameId];
      const insideNodeIds = state.getNodesInFrame(currentEditingFrameId);
      const title = frame ? frame.title : 'フレーム';
      const msg = `フレーム「${title}」と、枠内に含まれる全ノード（${insideNodeIds.length}件）を削除しますか？\n（※間違えても「元に戻す（Undo）」ボタンで復元できます）`;
      if (confirm(msg)) {
        state.deleteFrame(currentEditingFrameId, true);
        closeFrameEditModal();
      }
    });
  }

  const aiEngine = new window.AIEngine(state);

  // ===========================================================================
  // 🚪 左ペインの折りたたみ / 展開ロジック
  // ===========================================================================
  function collapseLeftSidebar() {
    leftSidebar.classList.add('w-0', 'opacity-0', 'pointer-events-none', 'border-none');
    leftSidebar.classList.remove('w-96', 'opacity-100');
    btnExpandSidebar.classList.remove('hidden');
    btnExpandSidebar.classList.add('flex');
    state.leftPaneCollapsed = true;
  }

  function expandLeftSidebar() {
    leftSidebar.classList.remove('w-0', 'opacity-0', 'pointer-events-none', 'border-none');
    leftSidebar.classList.add('w-96', 'opacity-100');
    btnExpandSidebar.classList.add('hidden');
    btnExpandSidebar.classList.remove('flex');
    state.leftPaneCollapsed = false;
  }

  btnCollapseSidebar.addEventListener('click', collapseLeftSidebar);
  btnExpandSidebar.addEventListener('click', expandLeftSidebar);

  // ===========================================================================
  // 🔄 状態変更時のUI同期リスナー (State ➔ UI)
  // ===========================================================================
  state.subscribe((eventType, payload, data) => {
    if (eventType !== 'node_moved') {
      canvas.render();
    }

    updateEditorView(data);

    if (eventType === 'message_added' || eventType === 'state_reset' || eventType === 'undo' || eventType === 'redo' || eventType === 'new_topic_started') {
      renderChatMessages(data);
    }

    if (eventType === 'node_selected') {
      highlightLinkedChatMessages(payload.nodeId);
    }

    if (eventType === 'custom_tag_created' || eventType === 'node_tags_updated') {
      const selNode = data.nodes[data.selectedNodeId];
      renderCustomTags(selNode, data);
    }

    if (eventType === 'theme_changed' && payload?.theme) {
      applyTheme(payload.theme);
    }

    if (selectLayoutMode && data.settings?.layoutMode) {
      if (selectLayoutMode.value !== data.settings.layoutMode) {
        selectLayoutMode.value = data.settings.layoutMode;
      }
    }

    btnUndo.disabled = state.undoStack.length === 0;
    btnRedo.disabled = state.redoStack.length === 0;
    btnUndo.classList.toggle('opacity-30', btnUndo.disabled);
    btnRedo.classList.toggle('opacity-30', btnRedo.disabled);
  });

  function updateEditorView(data) {
    const selectedId = data.selectedNodeId;
    const node = data.nodes[selectedId];

    if (!node) {
      if (editorNodeTitle) editorNodeTitle.value = '';
      if (editorNodeContent) editorNodeContent.value = '';
      if (editorNodeGroup) editorNodeGroup.value = '';
      if (editorDeleteBtn) editorDeleteBtn.disabled = true;
      if (editorAddChildBtn) editorAddChildBtn.disabled = true;
      if (editorNodeRole) editorNodeRole.value = 'None';
      if (promptInput) promptInput.placeholder = 'アイデアや疑問をAIに入力...';
      if (nodeOriginCard && nodeOriginText) {
        nodeOriginCard.classList.add('hidden');
      }
      if (colorButtons && colorButtons.length > 0) {
        colorButtons.forEach(btn => {
          btn.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2', 'scale-110');
        });
      }
      renderCustomTags(null, data);
      return;
    }

    if (editorNodeTitle && document.activeElement !== editorNodeTitle) editorNodeTitle.value = node.title || '';
    if (editorNodeContent && document.activeElement !== editorNodeContent) editorNodeContent.value = node.content || '';
    if (editorNodeGroup && document.activeElement !== editorNodeGroup) editorNodeGroup.value = node.group || '';
    if (editorNodeStatus) editorNodeStatus.value = node.status || 'None';
    if (editorNodeType) editorNodeType.value = node.nodeType || 'Idea';
    if (editorNodeRole) editorNodeRole.value = node.roleTag || 'None';

    // 🎨 カラーパレットの選択状態同期
    const activeColor = node.color || 'default';
    if (colorButtons && colorButtons.length > 0) {
      colorButtons.forEach(btn => {
        const isSelected = btn.dataset.color === activeColor;
        btn.classList.toggle('ring-2', isSelected);
        btn.classList.toggle('ring-indigo-500', isSelected);
        btn.classList.toggle('ring-offset-2', isSelected);
        btn.classList.toggle('scale-110', isSelected);
      });
    }

    if (editorDeleteBtn) editorDeleteBtn.disabled = !node.parentId;
    if (editorAddChildBtn) editorAddChildBtn.disabled = false;

    // 🌱 ノード誕生きっかけバッジの即時反映（スクロール不要！）
    if (nodeOriginCard && nodeOriginText) {
      nodeOriginCard.classList.remove('hidden');
      if (node.originPrompt) {
        nodeOriginText.textContent = node.originPrompt;
        nodeOriginText.title = `誕生のきっかけ: ${node.originPrompt}`;
      } else if (!node.parentId) {
        nodeOriginText.textContent = `「${node.title || 'マインドマップ'}」のテーマから開始`;
        nodeOriginText.title = '思考整理のメインテーマ';
      } else {
        nodeOriginText.textContent = '手動で追加されたノード';
        nodeOriginText.title = 'ユーザー自身によって追加されたノード';
      }
    }

    if (promptInput) promptInput.placeholder = `「${node.title}」について質問・相談・アイデア入力...`;
    renderCustomTags(node, data);
  }

  /**
   * 🏷️ ユーザー作成カスタムタグの一覧描画とトグル
   */
  function renderCustomTags(node, data) {
    if (!customTagsContainer) return;
    customTagsContainer.innerHTML = '';

    const tags = data.customTags || [];
    if (tags.length === 0) {
      customTagsContainer.innerHTML = '<span class="text-[10px] text-slate-400">タグ未作成（上の「＋タグ作成」から追加可能）</span>';
      return;
    }

    const nodeTags = node && node.tags ? node.tags : [];

    tags.forEach(tag => {
      const isAttached = nodeTags.includes(tag.id);
      const tagBtn = document.createElement('button');
      tagBtn.type = 'button';
      tagBtn.className = `px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-150 border cursor-pointer ${
        isAttached 
          ? 'bg-amber-500 text-white border-amber-600 shadow-2xs scale-105' 
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
      }`;
      tagBtn.innerHTML = `${isAttached ? '✓ ' : ''}${tag.name}`;
      tagBtn.title = isAttached ? 'クリックでノードから外す' : 'クリックでこのノードに付与';

      tagBtn.addEventListener('click', () => {
        if (!node) {
          alert('タグを付けるノードを選択してください。');
          return;
        }
        state.toggleNodeTag(node.id, tag.id);
      });

      customTagsContainer.appendChild(tagBtn);
    });
  }

  if (btnCreateTag) {
    btnCreateTag.addEventListener('click', () => {
      const tagName = prompt('新しいタグの名前を入力してください（例: 最優先、要調査、ミル造案など）:');
      if (tagName && tagName.trim()) {
        const newTag = state.createCustomTag(tagName.trim());
        if (state.data.selectedNodeId && newTag) {
          state.toggleNodeTag(state.data.selectedNodeId, newTag.id);
        }
      }
    });
  }

  /**
   * 💬 チャット対話履歴の描画とノード同期クリック
   */
  /**
   * 💬 チャット対話履歴の描画とノード同期クリック
   */
  function renderChatMessages(data) {
    chatMessagesElm.innerHTML = '';
    data.messages.forEach(msg => {
      const isAI = msg.sender === 'ai';
      const msgDiv = document.createElement('div');
      msgDiv.id = `chat-msg-${msg.id}`;
      msgDiv.className = `chat-msg-item flex gap-2.5 transition-all duration-300 p-2 rounded-2xl cursor-pointer hover:bg-slate-100/80 ${isAI ? 'items-start chat-msg-ai' : 'items-end flex-row-reverse chat-msg-user'}`;
      msgDiv.setAttribute('data-msg-id', msg.id);
      msgDiv.setAttribute('data-linked-nodes', (msg.linkedNodeIds || []).join(','));
      msgDiv.title = 'クリックすると対応する思考ノードへジャンプ＆ハイライトします';

      msgDiv.innerHTML = `
        <div class="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 shadow-2xs ${isAI ? 'bg-amber-100 text-amber-800' : 'bg-blue-600 text-white'}">
          ${isAI ? '🤖' : '👤'}
        </div>
        <div class="chat-bubble max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs border transition-all duration-300 ${isAI ? 'bg-white border-slate-200 text-slate-800' : 'bg-blue-600 border-blue-600 text-white'}">
          <!-- ノード選択時にピカッと光る「✨ このノードを生んだ対話」バッジ -->
          <div class="chat-badge-container hidden mb-1.5">
            <span class="chat-origin-badge">✨ このノードを生んだ対話</span>
          </div>
          <div class="whitespace-pre-wrap">${escapeHtml(msg.text)}</div>
          <div class="text-[9px] mt-1 opacity-60 text-right flex items-center justify-end gap-1">
            ${msg.linkedNodeIds && msg.linkedNodeIds.length > 0 ? '<span class="text-amber-600 font-semibold">📍ノード連動</span>' : ''}
            <span>${msg.timestamp}</span>
          </div>
        </div>
      `;

      // 会話クリックで該当ノードへジャンプ＆ハイライト（成果ノード優先＆テキストフォールバック）
      msgDiv.addEventListener('click', () => {
        const rawLinked = msg.linkedNodeIds || [];
        const allNodes = state.data.nodes;

        // 1. ツリー上に現存する有効なノードIDのみをフィルタリング
        const validNodeIds = rawLinked.filter(id => Boolean(allNodes[id]));

        let targetNodeId = null;

        if (validNodeIds.length > 0) {
          // 親ノード（質問元）と子ノード（成果物）が含まれている場合、
          // 会話によって新しく生まれた「子ノード（成果物）」を優先的に選ぶ！
          if (validNodeIds.length > 1) {
            // 先頭以外の新ノード群から親を持つ子ノードを探す
            const childNodeId = validNodeIds.slice(1).find(id => allNodes[id] && allNodes[id].parentId);
            targetNodeId = childNodeId || validNodeIds[validNodeIds.length - 1];
          } else {
            targetNodeId = validNodeIds[0];
          }
        }

        // 2. もし linkedNodeIds で見つからない場合、メッセージ本文からツリー上のノードを自動検出
        if (!targetNodeId) {
          const msgText = (msg.text || '').toLowerCase();
          for (const node of Object.values(allNodes)) {
            if (node.title && node.title.length >= 2 && msgText.includes(node.title.toLowerCase())) {
              targetNodeId = node.id;
              break;
            }
          }
        }

        // 3. それでも見つからない場合、現在選択中のノードまたはルートノードへ安全にフォールバック
        if (!targetNodeId || !allNodes[targetNodeId]) {
          targetNodeId = state.data.selectedNodeId || Object.keys(allNodes)[0];
        }

        if (targetNodeId && allNodes[targetNodeId]) {
          state.selectNode(targetNodeId);
          canvas.focusNode(targetNodeId);
          highlightLinkedChatMessages(targetNodeId);
        }
      });

      chatMessagesElm.appendChild(msgDiv);
    });

    chatMessagesElm.scrollTop = chatMessagesElm.scrollHeight;
  }

  /**
   * ✨ 選択ノードを生み出した「質問 ＋ AI回答」の会話ペアを黄金色にハイライト！
   */
  function highlightLinkedChatMessages(nodeId) {
    const allMsgElms = chatMessagesElm.querySelectorAll('.chat-msg-item');
    const node = state.data.nodes[nodeId];
    if (!node) return;

    // 1. まずノード自身（nodeId）が直接紐付いているメッセージを探す
    let matchedElms = [];
    allMsgElms.forEach(elm => {
      const linked = elm.getAttribute('data-linked-nodes') || '';
      const linkedList = linked.split(',').filter(Boolean);
      if (linkedList.includes(nodeId)) {
        matchedElms.push(elm);
      }
    });

    // 2. もし直接紐付くメッセージがない場合（手動追加など）、親ノードの会話にフォールバック
    if (matchedElms.length === 0 && node.parentId) {
      allMsgElms.forEach(elm => {
        const linked = elm.getAttribute('data-linked-nodes') || '';
        const linkedList = linked.split(',').filter(Boolean);
        if (linkedList.includes(node.parentId)) {
          matchedElms.push(elm);
        }
      });
    }

    // 3. さらに見つからない場合、ノードタイトルが含まれるメッセージをテキスト検索（フォールバック）
    if (matchedElms.length === 0 && node.title && node.title.length >= 2) {
      allMsgElms.forEach(elm => {
        const textContent = elm.textContent || '';
        if (textContent.includes(node.title)) {
          matchedElms.push(elm);
        }
      });
    }

    // 4. 全メッセージのハイライト状態を更新
    allMsgElms.forEach(elm => {
      const bubble = elm.querySelector('.chat-bubble');
      const badge = elm.querySelector('.chat-badge-container');
      const isTarget = matchedElms.includes(elm);

      if (isTarget) {
        elm.classList.add('bg-amber-50/70');
        if (bubble) bubble.classList.add('chat-bubble-highlighted');
        if (badge) badge.classList.remove('hidden');
      } else {
        elm.classList.remove('bg-amber-50/70');
        if (bubble) bubble.classList.remove('chat-bubble-highlighted');
        if (badge) badge.classList.add('hidden');
      }
    });

    // 5. マッチした会話ペアがチャットの中央に見えるようスムーズにスクロール
    if (matchedElms.length > 0) {
      matchedElms[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ===========================================================================
  // ✍️ エディタ入力イベント
  // ===========================================================================
  editorNodeTitle.addEventListener('input', (e) => {
    const selId = state.data.selectedNodeId;
    if (selId) state.updateNode(selId, { title: e.target.value });
  });

  editorNodeContent.addEventListener('input', (e) => {
    const selId = state.data.selectedNodeId;
    if (selId) state.updateNode(selId, { content: e.target.value });
  });

  editorNodeStatus.addEventListener('change', (e) => {
    const selId = state.data.selectedNodeId;
    if (selId) state.updateNode(selId, { status: e.target.value });
  });

  editorNodeType.addEventListener('change', (e) => {
    const selId = state.data.selectedNodeId;
    if (selId) state.updateNode(selId, { nodeType: e.target.value });
  });

  if (editorNodeRole) {
    editorNodeRole.addEventListener('change', (e) => {
      const selId = state.data.selectedNodeId;
      if (selId) state.updateNode(selId, { roleTag: e.target.value });
    });
  }

  // 📂 ノードグループ名の変更
  if (editorNodeGroup) {
    editorNodeGroup.addEventListener('input', (e) => {
      const selId = state.data.selectedNodeId;
      if (selId) {
        state.updateNode(selId, { group: e.target.value.trim() });
      }
    });
  }

  // 🎨 ノード色パレットのクリック
  if (colorButtons && colorButtons.length > 0) {
    colorButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const selId = state.data.selectedNodeId;
        const chosenColor = btn.dataset.color || 'default';
        if (selId) {
          state.updateNode(selId, { color: chosenColor });
          // パレット上のアクティブリングを即座に更新
          colorButtons.forEach(b => {
            const isSelected = b.dataset.color === chosenColor;
            b.classList.toggle('ring-2', isSelected);
            b.classList.toggle('ring-indigo-500', isSelected);
            b.classList.toggle('ring-offset-2', isSelected);
            b.classList.toggle('scale-110', isSelected);
          });
        }
      });
    });
  }

  if (editorAddChildBtn) {
    editorAddChildBtn.addEventListener('click', () => {
      const selId = state.data.selectedNodeId;
      if (selId) {
        openAddNodeModal(selId);
      }
    });
  }

  if (editorDeleteBtn) {
    editorDeleteBtn.addEventListener('click', () => {
      const selId = state.data.selectedNodeId;
      if (selId) {
        state.deleteNode(selId);
      }
    });
  }

  // ===========================================================================
  // 💬 プロンプト送信（IME確定ガード ＆ 問答双方向リンク）
  // ===========================================================================
  async function handleSendPrompt() {
    const text = promptInput.value.trim();
    if (!text) return;

    const currentSelId = state.data.selectedNodeId;

    const userMsg = state.addMessage('user', text, [currentSelId]);
    promptInput.value = '';

    sendPromptBtn.disabled = true;
    sendPromptBtn.innerHTML = `
      <svg class="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
    `;

    try {
      const result = await aiEngine.processUserPrompt(text, currentSelId);
      // ユーザーの質問メッセージにも、生み出された子ノード群を相互リンク！
      if (result && result.addedIds && userMsg) {
        userMsg.linkedNodeIds = Array.from(new Set([...(userMsg.linkedNodeIds || []), ...result.addedIds]));
        state.saveState();
        renderChatMessages(state.data);
        if (result.addedIds.length > 0) {
          const firstAddedId = result.addedIds[0];
          state.selectNode(firstAddedId);
          canvas.focusNode(firstAddedId);
          highlightLinkedChatMessages(firstAddedId);
        } else {
          highlightLinkedChatMessages(currentSelId);
        }
      }
    } catch (err) {
      console.error('プロンプト処理エラー:', err);
      state.addMessage('ai', 'エラーが発生しました: ' + err.message);
    } finally {
      sendPromptBtn.disabled = false;
      sendPromptBtn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
        </svg>
      `;
    }
  }

  sendPromptBtn.addEventListener('click', handleSendPrompt);

  promptInput.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  });

  // ===========================================================================
  // ⚡ 8大AI思考コマンド
  // ===========================================================================
  async function handleAICommand(type) {
    const selId = state.data.selectedNodeId;
    if (!selId) return;

    const btns = [
      cmdExpandBtn, cmdDeepenBtn, cmdAlternativeBtn, cmdTaskifyBtn,
      cmdExampleBtn, cmdWhyBtn, cmdProsconsBtn, cmdSummarizeBtn
    ];
    btns.forEach(b => { if (b) b.disabled = true; });

    try {
      await aiEngine.executeCommand(type, selId);
    } catch (err) {
      console.error('AIコマンド実行エラー:', err);
    } finally {
      btns.forEach(b => { if (b) b.disabled = false; });
    }
  }

  if (cmdExpandBtn) cmdExpandBtn.addEventListener('click', () => handleAICommand('expand'));
  if (cmdDeepenBtn) cmdDeepenBtn.addEventListener('click', () => handleAICommand('deepen'));
  if (cmdAlternativeBtn) cmdAlternativeBtn.addEventListener('click', () => handleAICommand('alternative'));
  if (cmdTaskifyBtn) cmdTaskifyBtn.addEventListener('click', () => handleAICommand('taskify'));
  if (cmdExampleBtn) cmdExampleBtn.addEventListener('click', () => handleAICommand('example'));
  if (cmdWhyBtn) cmdWhyBtn.addEventListener('click', () => handleAICommand('why'));
  if (cmdProsconsBtn) cmdProsconsBtn.addEventListener('click', () => handleAICommand('proscons'));
  if (cmdSummarizeBtn) cmdSummarizeBtn.addEventListener('click', () => handleAICommand('summarize'));

  // ===========================================================================
  // ツールバー
  // ===========================================================================
  btnUndo.addEventListener('click', () => state.undo());
  btnRedo.addEventListener('click', () => state.redo());
  btnZoomIn.addEventListener('click', () => canvas.zoomIn());
  btnZoomOut.addEventListener('click', () => canvas.zoomOut());
  btnFitView.addEventListener('click', () => canvas.fitView());
  if (btnTidy) btnTidy.addEventListener('click', () => canvas.tidyLayout());
  if (selectLayoutMode) {
    selectLayoutMode.addEventListener('change', (e) => {
      canvas.setLayoutMode(e.target.value);
    });
  }

  btnExport.addEventListener('click', () => {
    let md = `# 思考マインドマップ エクスポート\n\n`;
    md += `作成日時: ${new Date().toLocaleString()}\n\n`;
    md += `## 📋 思考ノードツリー\n\n`;

    const tagMap = {};
    (state.data.customTags || []).forEach(t => { tagMap[t.id] = t.name; });

    Object.values(state.data.nodes).forEach(n => {
      const indent = n.parentId ? '  - ' : '- ';
      const typeIcons = {
        Idea: '💡', Task: '📋', Problem: '⚠️', Fact: '📌',
        Question: '❓', Goal: '🎯', Inspiration: '✨', Reference: '📚'
      };
      const icon = typeIcons[n.nodeType] || '💡';
      const statusText = (n.status && n.status !== 'None') ? ` [${n.status}]` : '';
      const tagsText = (n.tags && n.tags.length > 0)
        ? ` ${n.tags.map(tid => `🏷️#${tagMap[tid] || tid}`).join(' ')}`
        : '';

      md += `${indent}**${icon} ${n.title}**${statusText}${tagsText}\n`;
      if (n.content) md += `    - 詳細・メモ: ${n.content}\n`;
    });

    navigator.clipboard.writeText(md).then(() => {
      alert('マインドマップのMarkdownテキストをクリップボードにコピーしました！\nNotionやObsidianへそのまま貼り付けられます。');
    }).catch(() => {
      alert('Markdownを出力しました。');
    });
  });

  // ===========================================================================
  // 🌱 新しい題材を始めるモーダル
  // ===========================================================================
  btnNewTopic.addEventListener('click', () => {
    newTopicInput.value = '';
    newTopicModal.classList.remove('hidden');
    setTimeout(() => newTopicInput.focus(), 100);
  });

  closeTopicModalBtn.addEventListener('click', () => newTopicModal.classList.add('hidden'));
  cancelTopicBtn.addEventListener('click', () => newTopicModal.classList.add('hidden'));

  startTopicConfirmBtn.addEventListener('click', () => {
    const topic = newTopicInput.value.trim();
    if (!topic) {
      alert('思考整理の題材（テーマ）を入力してください。');
      return;
    }
    state.startNewTopic(topic);
    newTopicModal.classList.add('hidden');
    canvas.resetView();
    expandLeftSidebar();
  });

  newTopicInput.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      startTopicConfirmBtn.click();
    }
  });

  // ===========================================================================
  // ⚙️ 設定モーダル（Gemini APIキー & AIモデル選択）
  // ===========================================================================
  btnSettings.addEventListener('click', () => {
    apiKeyInput.value = state.data.settings?.geminiApiKey || '';
    if (geminiModelSelect) {
      geminiModelSelect.value = state.data.settings?.geminiModel || 'gemini-3.6-flash';
    }
    settingsModal.classList.remove('hidden');
  });

  closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

  saveSettingsBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    const model = geminiModelSelect ? geminiModelSelect.value : 'gemini-3.6-flash';
    state.updateSettings({ geminiApiKey: key, geminiModel: model });
    settingsModal.classList.add('hidden');
    alert(`設定を保存しました！\n選択中モデル: ${model}` + (key ? '\n本物のGoogle Gemini APIと通信します。' : '\n※APIキー未入力のため内蔵シミュレーションモードで動作します。'));
  });

  // 初期描画
  applyTheme(state.data.settings?.theme || 'whiteboard');
  if (selectLayoutMode && state.data.settings?.layoutMode) {
    selectLayoutMode.value = state.data.settings.layoutMode;
  }
  updateEditorView(state.data);
  renderChatMessages(state.data);
  if (state.data.selectedNodeId) {
    highlightLinkedChatMessages(state.data.selectedNodeId);
  }
  canvas.resetView();
});
