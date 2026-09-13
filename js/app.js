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

  /**
   * 🖼️ 画像をVGAサイズ（最大640x480）に軽量圧縮する関数（ミル造さんご要望）
   * 動作を重くせず、LocalStorageやJSONバックアップにも優しい約30〜50KBに圧縮します
   */
  function compressImageToVGA(file, callback) {
    if (!file || !file.type.startsWith('image/')) {
      alert('画像ファイル（PNG/JPEG/WebP等）を選択してください。');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 640;
        const maxH = 480;
        let w = img.width;
        let h = img.height;

        if (w > maxW || h > maxH) {
          if (w / h > maxW / maxH) {
            h = Math.round((h * maxW) / w);
            w = maxW;
          } else {
            w = Math.round((w * maxH) / h);
            h = maxH;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        // JPEG 75%品質で圧縮（VGAサイズで約30〜50KB）
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
        callback(compressedDataUrl);
      };
      img.onerror = () => {
        alert('画像の読み込みに失敗しました。別の画像をお試しください。');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /**
   * 🔍 画像拡大ライトボックスモーダルを開く
   */
  function openLightbox(src, caption = '') {
    if (!imageLightboxModal || !lightboxImage) return;
    lightboxImage.src = src;
    if (lightboxCaption) lightboxCaption.textContent = caption;
    imageLightboxModal.classList.remove('hidden');
  }

  /**
   * ✖️ 画像拡大ライトボックスモーダルを閉じる
   */
  function closeLightbox() {
    if (!imageLightboxModal || !lightboxImage) return;
    imageLightboxModal.classList.add('hidden');
    lightboxImage.src = '';
  }

  // 左ペイン要素
  const leftSidebar = document.getElementById('left-sidebar');
  const btnCollapseSidebar = document.getElementById('btn-collapse-sidebar');
  const btnExpandSidebar = document.getElementById('btn-expand-sidebar');

  // チャット・エディタ要素
  const chatMessagesElm = document.getElementById('chat-messages');
  const promptInput = document.getElementById('prompt-input');
  const sendPromptBtn = document.getElementById('send-prompt-btn');
  const aiThinkingIndicator = document.getElementById('ai-thinking-indicator');

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

  // 📷 ノード参照画像要素（ミル造さんご要望: VGA軽量化＆ノード内サムネイル）
  const nodeImagePreviewContainer = document.getElementById('node-image-preview-container');
  const nodeImagePreviewImg = document.getElementById('node-image-preview-img');
  const btnReplaceNodeImage = document.getElementById('btn-replace-node-image');
  const btnDeleteNodeImage = document.getElementById('btn-delete-node-image');
  const nodeImageUploadArea = document.getElementById('node-image-upload-area');
  const nodeImageFileInput = document.getElementById('node-image-file-input');

  // 🔍 画像拡大ライトボックス要素
  const imageLightboxModal = document.getElementById('image-lightbox-modal');
  const closeLightboxBtn = document.getElementById('close-lightbox-btn');
  const lightboxImage = document.getElementById('lightbox-image');
  const lightboxCaption = document.getElementById('lightbox-caption');

  // 📷 チャット欄の画像添付要素（ミル造さんご要望: 入力枠内カメラアイコンに一本化！）
  const chatAttachImageBtn = document.getElementById('chat-attach-image-btn');
  const chatClipImageBtn = document.getElementById('chat-clip-image-btn');
  const chatImageFileInput = document.getElementById('chat-image-file-input');
  const chatImageDot = document.getElementById('chat-image-dot');
  const chatAttachedImageBadge = document.getElementById('chat-attached-image-badge');
  const chatAttachedImageThumb = document.getElementById('chat-attached-image-thumb');
  const chatDetachImageBtn = document.getElementById('chat-detach-image-btn');

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
  const btnImport = document.getElementById('btn-import');
  const btnExport = document.getElementById('btn-export');
  const btnSettings = document.getElementById('btn-settings');
  const btnNewTopic = document.getElementById('btn-new-topic');
  const selectLayoutMode = document.getElementById('select-layout-mode');
  const btnAddFrame = document.getElementById('btn-add-frame');

  // 📥 インポートモーダル関連
  const importModal = document.getElementById('import-modal');
  const closeImportModalBtn = document.getElementById('close-import-modal-btn');
  const cancelImportModalBtn = document.getElementById('cancel-import-modal-btn');
  const executeImportBtn = document.getElementById('execute-import-btn');
  const importTextarea = document.getElementById('import-textarea');
  const importDetectedBadge = document.getElementById('import-detected-badge');
  const importTabBtns = document.querySelectorAll('.import-tab-btn');

  // 📤 エクスポートモーダル関連
  const exportModal = document.getElementById('export-modal');
  const closeExportModalBtn = document.getElementById('close-export-modal-btn');
  const cancelExportModalBtn = document.getElementById('cancel-export-modal-btn');
  const exportTabBtns = document.querySelectorAll('.export-tab-btn');
  const exportOptIncludeDetails = document.getElementById('export-opt-include-details');
  const exportOptAdoptedOnly = document.getElementById('export-opt-adopted-only');
  const exportPreviewTextarea = document.getElementById('export-preview-textarea');
  const btnExportCopy = document.getElementById('btn-export-copy');
  const btnExportDownload = document.getElementById('btn-export-download');

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
  const settingUserNameInput = document.getElementById('setting-user-name-input');
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
    setTimeout(() => { if (canvas) { canvas.resize(); canvas.render(); } }, 310);
  }

  function expandLeftSidebar() {
    leftSidebar.classList.remove('w-0', 'opacity-0', 'pointer-events-none', 'border-none');
    leftSidebar.classList.add('w-96', 'opacity-100');
    btnExpandSidebar.classList.add('hidden');
    btnExpandSidebar.classList.remove('flex');
    state.leftPaneCollapsed = false;
    setTimeout(() => { if (canvas) { canvas.resize(); canvas.render(); } }, 310);
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

    if (eventType === 'message_added' || eventType === 'state_reset' || eventType === 'undo' || eventType === 'redo' || eventType === 'new_topic_started' || eventType === 'node_image_deleted' || eventType === 'node_image_updated') {
      renderChatMessages(data);
    }

    if (eventType === 'settings_updated') {
      const selNode = data.nodes[data.selectedNodeId];
      renderCustomTags(selNode, data);
      renderChatMessages(data);
    }

    if (eventType === 'storage_quota_exceeded') {
      alert(`⚠️ 【データ保存の容量警告】\n${payload.message}`);
    }

    if (eventType === 'node_selected') {
      highlightLinkedChatMessages(payload.nodeId);
    }

    if (eventType === 'custom_tag_created' || eventType === 'node_tags_updated' || eventType === 'custom_tag_deleted') {
      const selNode = data.nodes[data.selectedNodeId];
      renderCustomTags(selNode, data);
      canvas.render(); // 🌟 ノード上のタグバッジを即座に再描画！
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
      if (nodeImagePreviewContainer) nodeImagePreviewContainer.classList.add('hidden');
      if (nodeImageUploadArea) nodeImageUploadArea.classList.add('hidden');
      if (chatAttachedImageBadge) chatAttachedImageBadge.classList.add('hidden');
      if (chatImageDot) chatImageDot.classList.add('hidden');
      if (chatClipImageBtn) chatClipImageBtn.classList.remove('text-amber-500');
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

    // 📷 参照画像のプレビュー同期（エディタ ＆ チャット入力枠内カメラアイコン）
    if (node.image) {
      if (nodeImagePreviewContainer) nodeImagePreviewContainer.classList.remove('hidden');
      if (nodeImagePreviewImg) nodeImagePreviewImg.src = node.image;
      if (nodeImageUploadArea) nodeImageUploadArea.classList.add('hidden');

      if (chatAttachedImageBadge) {
        chatAttachedImageBadge.classList.remove('hidden');
        if (chatAttachedImageThumb) chatAttachedImageThumb.src = node.image;
      }
      if (chatImageDot) chatImageDot.classList.remove('hidden');
      if (chatClipImageBtn) chatClipImageBtn.classList.add('text-amber-500');
    } else {
      if (nodeImagePreviewContainer) nodeImagePreviewContainer.classList.add('hidden');
      if (nodeImageUploadArea) nodeImageUploadArea.classList.remove('hidden');

      if (chatAttachedImageBadge) {
        chatAttachedImageBadge.classList.add('hidden');
        if (chatAttachedImageThumb) chatAttachedImageThumb.src = '';
      }
      if (chatImageDot) chatImageDot.classList.add('hidden');
      if (chatClipImageBtn) chatClipImageBtn.classList.remove('text-amber-500');
    }

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
    // 🏷️ ユーザー名の動的ラベル反映
    const customTagsLabel = document.getElementById('custom-tags-label');
    if (customTagsLabel) {
      const currentUserName = data?.settings?.userName || state.data.settings?.userName || 'ミル造';
      customTagsLabel.textContent = `🏷️ ${currentUserName}さんのカスタムタグ`;
    }

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
      const tagWrapper = document.createElement('div');
      tagWrapper.className = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all shadow-2xs ${
        isAttached 
          ? 'bg-amber-500 text-white border-amber-600 scale-105' 
          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
      }`;

      // タグ付け外しボタン
      const tagBtn = document.createElement('button');
      tagBtn.type = 'button';
      tagBtn.className = 'cursor-pointer flex items-center gap-0.5 focus:outline-none';
      tagBtn.innerHTML = `${isAttached ? '✓ ' : ''}🏷️ ${escapeHtml(tag.name)}`;
      tagBtn.title = isAttached ? 'クリックでノードから外す' : 'クリックでこのノードに付与';

      tagBtn.addEventListener('click', () => {
        if (!node) {
          alert('タグを付けるノードを選択してください。');
          return;
        }
        state.toggleNodeTag(node.id, tag.id);
      });
      tagWrapper.appendChild(tagBtn);

      // タグ削除（×）ボタン
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = `ml-0.5 text-[11px] font-bold cursor-pointer focus:outline-none transition-colors ${
        isAttached ? 'text-amber-100 hover:text-white' : 'text-slate-400 hover:text-rose-500'
      }`;
      delBtn.innerHTML = '×';
      delBtn.title = `タグ「${tag.name}」を削除`;
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`タグ「${tag.name}」を完全に削除しますか？\n（すべてのノードからも自動的に外れます）`)) {
          state.deleteCustomTag(tag.id);
        }
      });
      tagWrapper.appendChild(delBtn);

      customTagsContainer.appendChild(tagWrapper);
    });
  }

  if (btnCreateTag) {
    btnCreateTag.addEventListener('click', () => {
      const tagName = prompt('新しいタグの名前を入力してください（例: 最優先、要調査、ミル造案など）:');
      if (tagName && tagName.trim()) {
        const newTag = state.createCustomTag(tagName.trim());
        const selId = state.data.selectedNodeId;
        if (selId && newTag) {
          state.toggleNodeTag(selId, newTag.id);
        }
      }
    });
  }

  /**
   * 💬 チャット対話履歴の描画とノード同期クリック
   */
  function renderChatMessages(data) {
    chatMessagesElm.innerHTML = '';
    const currentUserName = data?.settings?.userName || state.data.settings?.userName || 'ミル造';

    data.messages.forEach(msg => {
      const isAI = msg.sender === 'ai';
      const senderName = isAI ? 'AI' : currentUserName;
      const msgDiv = document.createElement('div');
      msgDiv.id = `chat-msg-${msg.id}`;
      msgDiv.className = `chat-msg-item flex gap-2.5 transition-all duration-300 p-2 rounded-2xl cursor-pointer hover:bg-slate-100/80 ${isAI ? 'items-start chat-msg-ai' : 'items-end flex-row-reverse chat-msg-user'}`;
      msgDiv.setAttribute('data-msg-id', msg.id);
      msgDiv.setAttribute('data-linked-nodes', (msg.linkedNodeIds || []).join(','));
      msgDiv.title = 'クリックすると対応する思考ノードへジャンプ＆ハイライトします';

      msgDiv.innerHTML = `
        <div class="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 shadow-2xs ${isAI ? 'bg-amber-100 text-amber-800' : 'bg-blue-600 text-white'}" title="${isAI ? 'AI' : escapeHtml(senderName)}">
          ${isAI ? '🤖' : '👤'}
        </div>
        <div class="chat-bubble max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs border transition-all duration-300 ${isAI ? 'bg-white border-slate-200 text-slate-800' : 'bg-blue-600 border-blue-600 text-white'}">
          <!-- 発言者名表示（ミル造さんご要望: ユーザー設定をリアルタイム反映） -->
          <div class="text-[10px] font-semibold mb-1 opacity-75 flex items-center gap-1 ${isAI ? 'text-amber-700' : 'text-blue-100'}">
            <span>${isAI ? '🤖 AI' : `👤 ${escapeHtml(senderName)}`}</span>
          </div>
          <!-- ノード選択時にピカッと光る「✨ このノードを生んだ対話」バッジ -->
          <div class="chat-badge-container hidden mb-1.5">
            <span class="chat-origin-badge">✨ このノードを生んだ対話</span>
          </div>
          <div class="whitespace-pre-wrap">${escapeHtml(msg.text)}</div>
          ${msg.image ? `
            <div class="chat-image-card relative group my-2 shadow-2xs border border-slate-200/60 rounded-xl overflow-hidden bg-black/5" data-image="${msg.image}" title="クリックで拡大表示">
              <!-- 画像削除ボタン（ノードとチャットの完全双方向同期） -->
              <button type="button" class="btn-delete-chat-image absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold opacity-80 hover:opacity-100 transition-all z-20" title="画像を削除">×</button>
              <img src="${msg.image}" alt="参照画像" class="rounded-xl">
              <div class="image-zoom-overlay">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                <span>クリックで拡大</span>
              </div>
            </div>
          ` : ''}
          <div class="text-[9px] mt-1 opacity-60 text-right flex items-center justify-end gap-1">
            ${msg.linkedNodeIds && msg.linkedNodeIds.length > 0 ? '<span class="text-amber-600 font-semibold">📍ノード連動</span>' : ''}
            <span>${msg.timestamp}</span>
          </div>
        </div>
      `;

      // 🗑️ チャット内の画像カード上の「×」削除ボタン
      const btnDelChatImg = msgDiv.querySelector('.btn-delete-chat-image');
      if (btnDelChatImg) {
        btnDelChatImg.addEventListener('click', (e) => {
          e.stopPropagation(); // 拡大ライトボックスやノードジャンプを阻止
          const targetNodeId = (msg.linkedNodeIds && msg.linkedNodeIds[0]) || state.data.selectedNodeId;
          if (targetNodeId) {
            if (confirm('この参照画像を削除しますか？\n（ノードとチャット双方から安全に削除されます）')) {
              state.removeNodeImage(targetNodeId);
            }
          }
        });
      }

      // 🔍 画像クリック時はノードジャンプではなくライトボックスを開く
      const chatImgCard = msgDiv.querySelector('.chat-image-card');
      if (chatImgCard && msg.image) {
        chatImgCard.addEventListener('click', (e) => {
          e.stopPropagation();
          openLightbox(msg.image, 'チャット参照画像プレビュー');
        });
      }

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
  // 📷 参照画像の添付・削除・ライトボックス制御（ミル造さんご要望）
  // ===========================================================================
  function attachImageToCurrentNode(file) {
    let selId = state.data.selectedNodeId;
    if (!selId) {
      const allNodeIds = Object.keys(state.data.nodes);
      if (allNodeIds.length > 0) {
        selId = allNodeIds[0];
        state.selectNode(selId);
        canvas.focusNode(selId);
      } else {
        alert('画像を添付するノードを選択してください。');
        return;
      }
    }
    const node = state.data.nodes[selId];
    if (!node) return;

    compressImageToVGA(file, (compressedDataUrl) => {
      // 1. ノードに画像保存 ＆ チャット履歴上書き同期（1ノード最大1枚制限・無限増殖防止！）
      state.setNodeImage(selId, compressedDataUrl);

      // 2. エディタプレビュー更新
      if (nodeImagePreviewContainer) nodeImagePreviewContainer.classList.remove('hidden');
      if (nodeImagePreviewImg) nodeImagePreviewImg.src = compressedDataUrl;
      if (nodeImageUploadArea) nodeImageUploadArea.classList.add('hidden');

      // 3. チャット欄の画像インジケーター更新（入力枠内カメラアイコンのドット点灯）
      if (chatAttachedImageBadge) {
        chatAttachedImageBadge.classList.remove('hidden');
        if (chatAttachedImageThumb) chatAttachedImageThumb.src = compressedDataUrl;
      }
      if (chatImageDot) chatImageDot.classList.remove('hidden');
      if (chatClipImageBtn) chatClipImageBtn.classList.add('text-amber-500');
    });
  }

  // 📷 画像選択ダイアログの起動共通処理（エディタ側からの呼び出し用）
  const triggerImageUpload = () => {
    let selId = state.data.selectedNodeId;
    if (!selId) {
      const allNodeIds = Object.keys(state.data.nodes);
      if (allNodeIds.length > 0) {
        selId = allNodeIds[0];
        state.selectNode(selId);
        canvas.focusNode(selId);
      } else {
        alert('画像を添付するノードを選択してください。');
        return;
      }
    }
    const targetInput = chatImageFileInput || nodeImageFileInput;
    if (targetInput) {
      targetInput.value = '';
      targetInput.click();
    }
  };

  // 🌟 チャット欄のファイル入力変更イベント（labelクリックでOSダイアログが直接開いた後の処理）
  if (chatImageFileInput) {
    chatImageFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        attachImageToCurrentNode(file);
      }
      chatImageFileInput.value = '';
    });
  }

  // 🌟 チャット欄ボタンクリック時のノード事前選択保証
  const ensureSelectedNodeForUpload = () => {
    if (!state.data.selectedNodeId) {
      const allNodeIds = Object.keys(state.data.nodes);
      if (allNodeIds.length > 0) {
        state.selectNode(allNodeIds[0]);
        canvas.focusNode(allNodeIds[0]);
      }
    }
  };
  if (chatAttachImageBtn) chatAttachImageBtn.addEventListener('click', ensureSelectedNodeForUpload);
  if (chatClipImageBtn) chatClipImageBtn.addEventListener('click', ensureSelectedNodeForUpload);

  // 🌟 入力枠内カメラアイコンのドット（添付中マーク）クリックで画像解除
  if (chatImageDot) {
    chatImageDot.style.cursor = 'pointer';
    chatImageDot.title = '画像が添付されています（クリックで解除）';
    chatImageDot.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const selId = state.data.selectedNodeId;
      if (!selId) return;
      if (confirm('添付されている参照画像を解除（削除）しますか？\n（ノードとチャット双方から安全に削除されます）')) {
        state.removeNodeImage(selId);
      }
    });
  }

  // 🌟 チャット欄バッジの削除（×）ボタン
  if (chatDetachImageBtn) {
    chatDetachImageBtn.addEventListener('click', () => {
      const selId = state.data.selectedNodeId;
      if (!selId) return;
      if (confirm('添付されている参照画像を削除しますか？\n（ノードとチャット双方から安全に削除されます）')) {
        state.removeNodeImage(selId);
        if (chatAttachedImageBadge) chatAttachedImageBadge.classList.add('hidden');
        if (nodeImagePreviewContainer) nodeImagePreviewContainer.classList.add('hidden');
        if (nodeImageUploadArea) nodeImageUploadArea.classList.remove('hidden');
      }
    });
  }

  // 🌟 チャット欄バッジのサムネイルクリックで拡大プレビュー
  if (chatAttachedImageThumb) {
    chatAttachedImageThumb.addEventListener('click', () => {
      const selId = state.data.selectedNodeId;
      const node = selId ? state.data.nodes[selId] : null;
      if (node && node.image) {
        openLightbox(node.image, `「${node.title || 'ノード'}」の参照画像`);
      }
    });
  }

  // 1. アップロード枠クリックでファイル選択
  if (nodeImageUploadArea && nodeImageFileInput) {
    nodeImageUploadArea.addEventListener('click', triggerImageUpload);
  }

  // 2. 差し替えボタンクリック
  if (btnReplaceNodeImage && nodeImageFileInput) {
    btnReplaceNodeImage.addEventListener('click', triggerImageUpload);
  }

  // 3. ファイルinput変更イベント
  if (nodeImageFileInput) {
    nodeImageFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        attachImageToCurrentNode(file);
      }
    });
  }

  // 4. 画像削除ボタン
  if (btnDeleteNodeImage) {
    btnDeleteNodeImage.addEventListener('click', () => {
      const selId = state.data.selectedNodeId;
      if (!selId) return;
      if (confirm('添付されている参照画像を削除しますか？\n（ノードとチャット双方から安全に削除されます）')) {
        state.removeNodeImage(selId);
        if (chatAttachedImageBadge) chatAttachedImageBadge.classList.add('hidden');
        if (nodeImagePreviewContainer) nodeImagePreviewContainer.classList.add('hidden');
        if (nodeImageUploadArea) nodeImageUploadArea.classList.remove('hidden');
      }
    });
  }

  // 5. エディタ内のサムネイルクリックで拡大ライトボックス
  if (nodeImagePreviewImg) {
    nodeImagePreviewImg.addEventListener('click', () => {
      const selId = state.data.selectedNodeId;
      const node = selId ? state.data.nodes[selId] : null;
      if (node && node.image) {
        openLightbox(node.image, `「${node.title || 'ノード'}」の参照画像`);
      }
    });
  }

  // 6. 🖱️ ドラッグ＆ドロップ対応（画面全体どこでも画像ドロップで選択ノードに添付）
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        attachImageToCurrentNode(file);
      }
    }
  });

  // 7. 📋 クリップボード貼り付け（Cmd+V / Ctrl+V）対応
  window.addEventListener('paste', (e) => {
    // inputやtextareaに通常のテキスト入力中は誤爆を防ぐ
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl.id !== 'prompt-input') {
      return;
    }

    if (e.clipboardData && e.clipboardData.items) {
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        const item = e.clipboardData.items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            attachImageToCurrentNode(file);
            break;
          }
        }
      }
    }
  });

  // 8. 🔍 ライトボックスモーダルを閉じるイベント
  if (closeLightboxBtn) {
    closeLightboxBtn.addEventListener('click', closeLightbox);
  }
  if (imageLightboxModal) {
    imageLightboxModal.addEventListener('click', (e) => {
      if (e.target === imageLightboxModal) {
        closeLightbox();
      }
    });
  }
  // ⌨️ グローバルキーボードショートカット（Escでモーダル閉じる ＆ Cmd+ZでUndo/Redo）
  window.addEventListener('keydown', (e) => {
    // 1. Escape キー: 開いているモーダルを閉じる
    if (e.key === 'Escape') {
      if (imageLightboxModal && !imageLightboxModal.classList.contains('hidden')) {
        closeLightbox();
        return;
      }
      if (settingsModal && !settingsModal.classList.contains('hidden')) {
        settingsModal.classList.add('hidden');
        return;
      }
      if (newTopicModal && !newTopicModal.classList.contains('hidden')) {
        newTopicModal.classList.add('hidden');
        return;
      }
      if (importModal && !importModal.classList.contains('hidden')) {
        importModal.classList.add('hidden');
        return;
      }
      if (exportModal && !exportModal.classList.contains('hidden')) {
        exportModal.classList.add('hidden');
        return;
      }
      if (addNodeModal && !addNodeModal.classList.contains('hidden')) {
        addNodeModal.classList.add('hidden');
        return;
      }
      if (groupCreateModal && !groupCreateModal.classList.contains('hidden')) {
        groupCreateModal.classList.add('hidden');
        return;
      }
      if (frameCreateModal && !frameCreateModal.classList.contains('hidden')) {
        frameCreateModal.classList.add('hidden');
        return;
      }
      if (frameEditModal && !frameEditModal.classList.contains('hidden')) {
        frameEditModal.classList.add('hidden');
        return;
      }
    }

    // 2. Cmd+Z / Ctrl+Z (Undo) & Cmd+Shift+Z / Ctrl+Y (Redo)
    const isInputActive = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
    if (!isInputActive) {
      const isMac = typeof navigator !== 'undefined' && navigator.platform && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      if (modKey && !e.altKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            state.redo();
          } else {
            state.undo();
          }
        } else if (!isMac && e.key.toLowerCase() === 'y') {
          e.preventDefault();
          state.redo();
        }
      }
    }
  });

  // ===========================================================================
  // 💬 プロンプト送信（IME確定ガード ＆ 問答双方向リンク ＆ 思考中ローディング）
  // ===========================================================================
  async function handleSendPrompt() {
    const text = promptInput.value.trim();
    if (!text) return;

    const currentSelId = state.data.selectedNodeId;

    const userMsg = state.addMessage('user', text, [currentSelId]);
    promptInput.value = '';

    // 💡 AI思考中UIのアクティブ化（ミル造さんご要望: 入力欄上部のスライド点滅＆ドットアニメーション）
    if (aiThinkingIndicator) {
      aiThinkingIndicator.classList.remove('hidden');
      const statusText = aiThinkingIndicator.querySelector('.thinking-status-text');
      if (statusText) statusText.textContent = 'アイデアを深掘り中…';
    }
    promptInput.disabled = true;
    sendPromptBtn.disabled = true;
    sendPromptBtn.innerHTML = `
      <svg class="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
    `;

    // チャット履歴最下部にも思考中バブルを表示
    const thinkingBubble = document.createElement('div');
    thinkingBubble.id = 'chat-thinking-bubble';
    thinkingBubble.className = 'chat-msg-item flex gap-2.5 items-start chat-msg-ai p-2 rounded-2xl animate-pulse';
    thinkingBubble.innerHTML = `
      <div class="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 shadow-2xs bg-amber-100 text-amber-800">
        🤖
      </div>
      <div class="chat-bubble rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-2xs border bg-amber-50/90 border-amber-200 text-amber-900 flex items-center gap-2">
        <span>💭</span>
        <span class="font-medium">AIが考え中</span>
        <div class="thinking-dots flex items-center gap-1">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    `;
    chatMessagesElm.appendChild(thinkingBubble);
    chatMessagesElm.scrollTop = chatMessagesElm.scrollHeight;

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
      // 💡 AI思考中UIの非表示化
      if (aiThinkingIndicator) {
        aiThinkingIndicator.classList.add('hidden');
      }
      const tb = document.getElementById('chat-thinking-bubble');
      if (tb) tb.remove();

      promptInput.disabled = false;
      promptInput.focus();
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
  const commandLabels = {
    expand: '展開（発散）コマンドを実行中…',
    deepen: '深掘り（具体化）コマンドを実行中…',
    alternative: '別案探索コマンドを実行中…',
    taskify: 'ToDo化コマンドを実行中…',
    example: '具体例出しコマンドを実行中…',
    why: 'なぜなぜ深掘りを実行中…',
    proscons: 'メリデメ比較コマンドを実行中…',
    summarize: '要約・整理コマンドを実行中…'
  };

  async function handleAICommand(type) {
    const selId = state.data.selectedNodeId;
    if (!selId) return;

    const btns = [
      cmdExpandBtn, cmdDeepenBtn, cmdAlternativeBtn, cmdTaskifyBtn,
      cmdExampleBtn, cmdWhyBtn, cmdProsconsBtn, cmdSummarizeBtn
    ];
    btns.forEach(b => { if (b) b.disabled = true; });

    if (aiThinkingIndicator) {
      aiThinkingIndicator.classList.remove('hidden');
      const statusText = aiThinkingIndicator.querySelector('.thinking-status-text');
      if (statusText) statusText.textContent = commandLabels[type] || '思考コマンドを実行中…';
    }

    try {
      await aiEngine.executeCommand(type, selId);
    } catch (err) {
      console.error('AIコマンド実行エラー:', err);
    } finally {
      btns.forEach(b => { if (b) b.disabled = false; });
      if (aiThinkingIndicator) {
        aiThinkingIndicator.classList.add('hidden');
      }
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

  // ===========================================================================
  // 📥 思考データの読み込み (インポートモーダル制御)
  // ===========================================================================
  let currentImportFormat = 'auto';

  const updateImportFormatUI = (format) => {
    currentImportFormat = format;
    importTabBtns.forEach(btn => {
      if (btn.dataset.format === format) {
        btn.className = 'import-tab-btn px-2.5 py-1.5 font-semibold rounded-lg text-indigo-700 bg-indigo-50 border border-indigo-200 transition-all cursor-pointer';
      } else {
        btn.className = 'import-tab-btn px-2.5 py-1.5 font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-all cursor-pointer';
      }
    });
  };

  const detectAndReflectFormat = () => {
    const val = importTextarea.value.trim();
    if (!val) {
      importDetectedBadge.textContent = '形式未判定';
      importDetectedBadge.className = 'px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 rounded-full border border-slate-200';
      return;
    }
    const detected = state.detectTextFormat(val);
    const badgeConfig = {
      json: { text: '💾 JSON検出', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      mermaid: { text: '📊 Mermaid検出', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
      markdown: { text: '📝 箇条書き検出', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
      ai: { text: '✨ 会話文・長文検出', color: 'bg-purple-100 text-purple-700 border-purple-200' }
    };
    const conf = badgeConfig[detected] || badgeConfig.markdown;
    importDetectedBadge.textContent = conf.text;
    importDetectedBadge.className = `px-2 py-0.5 text-[10px] font-semibold rounded-full border ${conf.color}`;
  };

  if (btnImport) {
    btnImport.addEventListener('click', () => {
      importTextarea.value = '';
      updateImportFormatUI('auto');
      detectAndReflectFormat();
      importModal.classList.remove('hidden');
      setTimeout(() => importTextarea.focus(), 100);
    });
  }

  if (closeImportModalBtn) {
    closeImportModalBtn.addEventListener('click', () => importModal.classList.add('hidden'));
  }
  if (cancelImportModalBtn) {
    cancelImportModalBtn.addEventListener('click', () => importModal.classList.add('hidden'));
  }

  importTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      updateImportFormatUI(btn.dataset.format);
    });
  });

  if (importTextarea) {
    importTextarea.addEventListener('input', detectAndReflectFormat);
  }

  if (executeImportBtn) {
    executeImportBtn.addEventListener('click', async () => {
      const text = importTextarea.value.trim();
      if (!text) {
        alert('テキストを貼り付けてください。');
        return;
      }

      // 取り込みモード取得（'replace' または 'append'）
      const selectedRadio = document.querySelector('input[name="import-mode"]:checked');
      const mode = selectedRadio ? selectedRadio.value : 'replace';

      // 判定形式の決定（autoの場合は検出結果）
      const effectiveFormat = currentImportFormat === 'auto' ? state.detectTextFormat(text) : currentImportFormat;

      executeImportBtn.disabled = true;
      const origBtnHtml = executeImportBtn.innerHTML;
      executeImportBtn.innerHTML = `<span>⚡ 解析・生成中...</span>`;

      try {
        let tree = null;
        if (effectiveFormat === 'json') {
          try {
            const parsed = JSON.parse(text);
            if (parsed.state) {
              state.data = parsed.state;
              state.saveState();
              state.notify('new_topic_started');
              importModal.classList.add('hidden');
              canvas.fitView();
              alert('JSONから完全復元しました！');
              return;
            } else {
              tree = parsed;
            }
          } catch (err) {
            alert('JSONの解析に失敗しました。形式をご確認ください。');
            return;
          }
        } else if (effectiveFormat === 'mermaid') {
          tree = state.parseMermaid(text);
        } else if (effectiveFormat === 'markdown') {
          tree = state.parseIndentedText(text);
        } else if (effectiveFormat === 'ai') {
          tree = await ai.extractMindMapFromText(text);
        }

        if (!tree) {
          // フォールバックで箇条書きとしてパース
          tree = state.parseIndentedText(text);
        }

        if (!tree) {
          alert('思考構造を解析できませんでした。テキスト内容をご確認ください。');
          return;
        }

        const success = state.importTreeData(tree, { mode, parentId: state.data.selectedNodeId });
        if (success) {
          importModal.classList.add('hidden');
          setTimeout(() => canvas.fitView(), 150);
          alert(mode === 'replace' ? '新しいマインドマップとして読み込みました！' : '選択ノードに思考ツリーを追加しました！');
        } else {
          alert('インポートに失敗しました。');
        }
      } catch (err) {
        console.error('インポート実行エラー:', err);
        alert('エラーが発生しました: ' + (err.message || err));
      } finally {
        executeImportBtn.disabled = false;
        executeImportBtn.innerHTML = origBtnHtml;
      }
    });
  }

  // ===========================================================================
  // 📤 思考データの書き出し (エクスポートモーダル制御)
  // ===========================================================================
  const exportTextOptions = document.getElementById('export-text-options');
  const exportPngOptions = document.getElementById('export-png-options');
  const exportImagePreviewWrapper = document.getElementById('export-image-preview-wrapper');
  const exportImagePreview = document.getElementById('export-image-preview');
  const exportPngThemeRadios = document.querySelectorAll('input[name="export-png-theme"]');
  let currentExportType = 'aicontext';
  let currentPngDataUrl = null;
  let currentPngBlob = null;

  const updateExportPreview = async () => {
    const includeDetails = exportOptIncludeDetails ? exportOptIncludeDetails.checked : true;
    const adoptedOnly = exportOptAdoptedOnly ? exportOptAdoptedOnly.checked : false;

    // 🖼️ PNG画像エクスポート処理
    if (currentExportType === 'png') {
      if (exportPreviewTextarea) exportPreviewTextarea.classList.add('hidden');
      if (exportImagePreviewWrapper) exportImagePreviewWrapper.classList.remove('hidden');
      if (exportTextOptions) exportTextOptions.classList.add('hidden');
      if (exportPngOptions) {
        exportPngOptions.classList.remove('hidden');
        exportPngOptions.classList.add('flex');
      }

      let selectedTheme = 'auto';
      if (exportPngThemeRadios) {
        exportPngThemeRadios.forEach(r => {
          if (r.checked) selectedTheme = r.value;
        });
      }

      if (canvas && typeof canvas.exportToCanvas === 'function') {
        try {
          const res = await canvas.exportToCanvas({
            theme: selectedTheme,
            adoptedOnly,
            includeDetails
          });
          currentPngDataUrl = res.dataUrl;
          currentPngBlob = res.blob;
          if (exportImagePreview) {
            exportImagePreview.src = res.dataUrl;
          }
        } catch (err) {
          console.error('PNG画像書き出しエラー:', err);
        }
      }
      return;
    }

    // 📝 テキスト系エクスポート (AI Context / Mermaid / Notion / JSON)
    if (exportPreviewTextarea) exportPreviewTextarea.classList.remove('hidden');
    if (exportImagePreviewWrapper) exportImagePreviewWrapper.classList.add('hidden');
    if (exportTextOptions) exportTextOptions.classList.remove('hidden');
    if (exportPngOptions) {
      exportPngOptions.classList.add('hidden');
      exportPngOptions.classList.remove('flex');
    }

    let output = '';
    if (currentExportType === 'aicontext') {
      output = state.exportAsAIContext({ includeDetails, adoptedOnly });
    } else if (currentExportType === 'mermaid') {
      output = state.exportAsMermaid({ adoptedOnly });
    } else if (currentExportType === 'notion') {
      output = state.exportAsNotionMarkdown({ includeDetails, adoptedOnly });
    } else if (currentExportType === 'json') {
      output = state.exportAsJSON();
    }

    if (exportPreviewTextarea) {
      exportPreviewTextarea.value = output;
    }
  };

  const exportGuideText = document.getElementById('export-guide-text');

  const updateExportTabUI = (type) => {
    currentExportType = type;
    exportTabBtns.forEach(btn => {
      if (btn.dataset.exportType === type) {
        btn.className = 'export-tab-btn px-3 py-1.5 font-bold rounded-lg text-amber-800 bg-amber-50 border border-amber-200 transition-all cursor-pointer';
      } else {
        btn.className = 'export-tab-btn px-3 py-1.5 font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-all cursor-pointer';
      }
    });

    // 💡 用途別ガイドヒントの更新
    if (exportGuideText) {
      if (type === 'mermaid') {
        exportGuideText.textContent = 'Notionの「/mermaid」枠の中身を全選択（Cmd+A）し、そのまま貼り付けると図になります';
      } else if (type === 'notion') {
        exportGuideText.textContent = 'Notionの通常ページ上でキーボードの「Cmd + V」を押すと、見出しや箇条書きリストになります';
      } else if (type === 'png') {
        exportGuideText.textContent = '高解像度PNG画像です。ダウンロードして保存するか、コピーしてNotionに貼り付けられます';
      } else if (type === 'aicontext') {
        exportGuideText.textContent = 'ChatGPTやGeminiのチャット欄に貼り付けると、これまでの思考を前提知識として渡せます';
      } else if (type === 'json') {
        exportGuideText.textContent = '思考データを完全に復元できるバックアップJSONです。「読み込み」からいつでも復元できます';
      }
    }

    // 🌟 タブに応じてフッターの「ダウンロード」ボタンの表示とスタイルを最適化！
    if (type === 'png') {
      if (btnExportDownload) {
        btnExportDownload.innerHTML = `<span>💾 PNG画像をダウンロード</span>`;
        btnExportDownload.className = 'flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow cursor-pointer active:scale-95';
      }
      if (btnExportCopy) {
        btnExportCopy.innerHTML = `<span>📋 クリップボードにコピー</span>`;
        btnExportCopy.className = 'flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer';
      }
    } else {
      if (btnExportDownload) {
        btnExportDownload.innerHTML = `<span>💾 ダウンロード保存</span>`;
        btnExportDownload.className = 'flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer';
      }
      if (btnExportCopy) {
        btnExportCopy.innerHTML = `<span>📋 クリップボードにコピー</span>`;
        btnExportCopy.className = 'flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow cursor-pointer';
      }
    }

    updateExportPreview();
  };

  if (btnExport) {
    btnExport.addEventListener('click', () => {
      updateExportTabUI('aicontext');
      exportModal.classList.remove('hidden');
    });
  }

  if (closeExportModalBtn) {
    closeExportModalBtn.addEventListener('click', () => exportModal.classList.add('hidden'));
  }
  if (cancelExportModalBtn) {
    cancelExportModalBtn.addEventListener('click', () => exportModal.classList.add('hidden'));
  }

  exportTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      updateExportTabUI(btn.dataset.exportType);
    });
  });

  if (exportOptIncludeDetails) {
    exportOptIncludeDetails.addEventListener('change', updateExportPreview);
  }
  if (exportOptAdoptedOnly) {
    exportOptAdoptedOnly.addEventListener('change', updateExportPreview);
  }
  if (exportPngThemeRadios) {
    exportPngThemeRadios.forEach(radio => {
      radio.addEventListener('change', updateExportPreview);
    });
  }

  // 🖼️ PNG画像のダウンロード共通実行関数（URL.createObjectURLによる確実なファイル保存）
  function triggerPngDownload() {
    if (!currentPngBlob && !currentPngDataUrl) {
      alert('画像を生成中です。少々お待ちください...');
      return;
    }

    const rootNode = Object.values(state.data.nodes).find(n => !n.parentId) || { title: 'hiramek' };
    const safeTitle = (rootNode.title || 'hiramek').replace(/[\\/:*?"<>| ]/g, '_').substring(0, 20);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `hiramek-mindmap-${safeTitle}-${dateStr}.png`;

    // 長大なDataURLではなくBlob ObjectURLを使用（ブラウザのURL長制限を完全回避）
    let downloadUrl = currentPngDataUrl;
    let revokeNeeded = false;
    if (currentPngBlob) {
      downloadUrl = URL.createObjectURL(currentPngBlob);
      revokeNeeded = true;
    }

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (revokeNeeded) {
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
    }

    // 成功フィードバック
    if (btnExportDownload) {
      const origHtml = btnExportDownload.innerHTML;
      btnExportDownload.innerHTML = `<span>✔️ ダウンロード開始！</span>`;
      btnExportDownload.classList.replace('bg-amber-500', 'bg-emerald-600');
      btnExportDownload.classList.replace('hover:bg-amber-600', 'hover:bg-emerald-700');
      setTimeout(() => {
        btnExportDownload.innerHTML = origHtml;
        btnExportDownload.classList.replace('bg-emerald-600', 'bg-amber-500');
        btnExportDownload.classList.replace('hover:bg-emerald-700', 'hover:bg-amber-600');
      }, 2000);
    }
  }

  // 🖼️ PNG画像のクリップボードコピー共通関数
  async function triggerPngCopy() {
    if (!currentPngBlob) {
      alert('画像を生成中です。少し待ってから再度お試しください。');
      return;
    }
    try {
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': currentPngBlob })
        ]);
        if (btnExportCopy) {
          const origText = btnExportCopy.innerHTML;
          btnExportCopy.innerHTML = `<span>✔️ 画像をコピー完了！</span>`;
          btnExportCopy.classList.replace('bg-amber-500', 'bg-emerald-600');
          btnExportCopy.classList.replace('hover:bg-amber-600', 'hover:bg-emerald-700');
          setTimeout(() => {
            btnExportCopy.innerHTML = origText;
            btnExportCopy.classList.replace('bg-emerald-600', 'bg-amber-500');
            btnExportCopy.classList.replace('hover:bg-emerald-700', 'hover:bg-amber-600');
          }, 2000);
        }
      } else {
        alert('お使いのブラウザでは画像の直接クリップボードコピーに対応していません。「ダウンロード」をお使いください。');
      }
    } catch (err) {
      console.warn('クリップボードコピー失敗:', err);
      alert('画像のコピーに失敗しました。「ダウンロード」から保存してください。');
    }
  }

  // 🖼️ プレビュー枠内のクイックアクションボタン
  const btnQuickDownloadPng = document.getElementById('btn-quick-download-png');
  const btnQuickCopyPng = document.getElementById('btn-quick-copy-png');
  if (btnQuickDownloadPng) {
    btnQuickDownloadPng.addEventListener('click', triggerPngDownload);
  }
  if (btnQuickCopyPng) {
    btnQuickCopyPng.addEventListener('click', triggerPngCopy);
  }

  // クリップボードにコピー（テキスト＆PNG画像両対応！）
  if (btnExportCopy) {
    btnExportCopy.addEventListener('click', async () => {
      if (currentExportType === 'png') {
        await triggerPngCopy();
        return;
      }

      // 📝 テキストのクリップボードコピー
      const content = exportPreviewTextarea.value;
      if (!content) return;
      navigator.clipboard.writeText(content).then(() => {
        const origText = btnExportCopy.innerHTML;
        btnExportCopy.innerHTML = `<span>✔️ コピー完了！</span>`;
        btnExportCopy.classList.replace('bg-amber-500', 'bg-emerald-600');
        btnExportCopy.classList.replace('hover:bg-amber-600', 'hover:bg-emerald-700');
        setTimeout(() => {
          btnExportCopy.innerHTML = origText;
          btnExportCopy.classList.replace('bg-emerald-600', 'bg-amber-500');
          btnExportCopy.classList.replace('hover:bg-emerald-700', 'hover:bg-amber-600');
        }, 2000);
      }).catch(err => {
        alert('コピーに失敗しました: ' + err);
      });
    });
  }

  // ファイルとして保存（ダウンロード：テキスト＆PNG画像両対応！）
  if (btnExportDownload) {
    btnExportDownload.addEventListener('click', () => {
      // 🖼️ PNG画像のファイルダウンロード
      if (currentExportType === 'png') {
        triggerPngDownload();
        return;
      }

      // 📝 テキストファイルのダウンロード
      const content = exportPreviewTextarea.value;
      if (!content) return;

      const rootNode = Object.values(state.data.nodes).find(n => !n.parentId) || { title: 'hiramek' };
      const safeTitle = (rootNode.title || 'hiramek').replace(/[\\/:*?"<>| ]/g, '_').substring(0, 20);
      const dateStr = new Date().toISOString().slice(0, 10);

      let filename = `hiramek-${safeTitle}-${dateStr}.md`;
      let mimeType = 'text/markdown;charset=utf-8';

      if (currentExportType === 'json') {
        filename = `hiramek-${safeTitle}-${dateStr}.json`;
        mimeType = 'application/json;charset=utf-8';
      } else if (currentExportType === 'mermaid') {
        filename = `hiramek-${safeTitle}-${dateStr}.mmd`;
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

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
  // ⚙️ 設定モーダル（ユーザー設定、Gemini APIキー & AIモデル選択）
  // ===========================================================================
  btnSettings.addEventListener('click', () => {
    if (settingUserNameInput) {
      settingUserNameInput.value = state.data.settings?.userName || 'ミル造';
    }
    apiKeyInput.value = state.data.settings?.geminiApiKey || '';
    if (geminiModelSelect) {
      geminiModelSelect.value = state.data.settings?.geminiModel || 'gemini-3.6-flash';
    }
    settingsModal.classList.remove('hidden');
  });

  closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

  saveSettingsBtn.addEventListener('click', () => {
    const userName = settingUserNameInput ? (settingUserNameInput.value.trim() || 'ミル造') : 'ミル造';
    const key = apiKeyInput.value.trim();
    const model = geminiModelSelect ? geminiModelSelect.value : 'gemini-3.6-flash';
    state.updateSettings({ userName, geminiApiKey: key, geminiModel: model });
    settingsModal.classList.add('hidden');
    alert(`設定を保存しました！\nユーザー名: ${userName}\n選択中モデル: ${model}` + (key ? '\n本物のGoogle Gemini APIと通信します。' : '\n※APIキー未入力のため内蔵シミュレーションモードで動作します。'));
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
