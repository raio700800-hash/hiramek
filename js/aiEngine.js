/**
 * =============================================================================
 * 🤖 AI思考アシスタントエンジン (aiEngine.js)
 * =============================================================================
 * 題材に合わせて1〜4個の適切な数でノードを柔軟に提案し、
 * タイトルを簡潔な要約フレーズとして生成します。
 */

class AIEngine {
  constructor(state) {
    this.state = state;
  }

  async processUserPrompt(promptText, targetNodeId = null) {
    const parentId = targetNodeId || this.state.data.selectedNodeId || 'root-1';
    const parentNode = this.state.data.nodes[parentId] || { title: '思考のテーマ', content: '' };
    const apiKey = this.state.data.settings?.geminiApiKey;

    if (apiKey && apiKey.trim().length > 10) {
      try {
        return await this.callGeminiAPI(promptText, parentNode, parentId);
      } catch (err) {
        console.warn('Gemini API通信エラー。内蔵思考エンジンにフォールバック:', err);
      }
    }

    return this.generateSimulatedBatch(promptText, parentNode, parentId);
  }

  /**
   * 8大思考コマンドの実行
   */
  async executeCommand(commandType, targetNodeId) {
    const node = this.state.data.nodes[targetNodeId];
    if (!node) return null;

    const commandPrompts = {
      expand: `「${node.title}」について、周辺の可能性やアイデアを広げて提案してください。`,
      deepen: `「${node.title}」を具体的に実現するための仕組みや深掘りポイントを提案してください。`,
      alternative: `「${node.title}」に対する別の角度からのアプローチや、あえて前提を疑った代替案を提案してください。`,
      taskify: `「${node.title}」を実行するために、今すぐ着手できる具体的なアクション（タスク）に分解してください。`,
      example: `「${node.title}」の具体的な利用シーンや身近な活用例を提案してください。`,
      why: `「${node.title}」を行う根本的な動機や、なぜそれが重要なのかの理由（本質）を提案してください。`,
      proscons: `「${node.title}」を採用した場合のメリット（良い点）とデメリット（注意点）を比較提案してください。`,
      summarize: `「${node.title}」の核心となる結論やまとめを提案してください。`
    };

    const promptText = commandPrompts[commandType] || commandPrompts.expand;
    return await this.processUserPrompt(promptText, targetNodeId);
  }

  /**
   * Google Gemini API 呼び出し（Gemini 3.6 Flash / 2.5 Flash-Lite等）
   */
  async callGeminiAPI(promptText, parentNode, parentId) {
    const apiKey = this.state.data.settings?.geminiApiKey;
    const model = this.state.data.settings?.geminiModel || 'gemini-3.6-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemInstruction = `
あなたは思考マインドマップアプリの専任メンターAIです。
親ノード「${parentNode.title}」についての思考整理を支援します。

【重要指示】
1. 生成するノード数は固定ではありません。題材の文脈に応じて【1個〜4個程度】の最も自然で複雑になりすぎない適正数にしてください（1個が適切な場合は1個、対立案なら2個、広げるなら3〜4個）。
2. ノードの「title」は、「解決策: 」「工夫点: 」「答え: 」「視点: 」「検証タスク: 」「アプローチ: 」「【視点】」といった不要な接頭辞や絵文字を絶対に含めず、【純粋な要約タイトル（10〜16文字程度）】にしてください。
3. nodeType は "Idea", "Task", "Problem", "Fact", "Question", "Goal", "Inspiration", "Reference" の中から最も相応しいものを割り当ててください。
4. roleTag（役割タグ）として "Mechanism" (仕組み), "Solution" (解決策), "Ingenuity" (工夫点), "Verification" (検証タスク), "Perspective" (視点), "Approach" (アプローチ), "None" の中から適切なものを割り当ててください。
5. 【最重要: 質問への直接的な具体解ノード化】
   - ユーザーの入力が「どんな仕組みがありますか？」「どんなアプリとの連携が強力ですか？」などの質問である場合、その質問に対する【直接的かつ具体的な答えそのもの（例: 自動ツリーレイアウト機構、Notion連携など）】をノードのtitleにしてください。
6. チャットへの返答「summaryMessage」には、ユーザーの問いに真っ向から答えた丁寧でわかりやすい解説を含めてください。

出力フォーマット（必ず以下のJSON形式のみを出力）:
{
  "summaryMessage": "ミル造さんへの温かく丁寧な返答メッセージ（問いへの具体的な解説・提案）",
  "nodes": [
    {
      "title": "問いに対する直接的・具体的な純粋タイトル（接頭辞なし・15文字前後）",
      "content": "詳しい解説や具体的な理由",
      "status": "None",
      "nodeType": "Idea",
      "roleTag": "Mechanism"
    }
  ]
}
`;

    const userContent = `【対象の親ノード】: 「${parentNode.title}」\n【詳細メモ】: 「${parentNode.content || 'なし'}」\n【ユーザーの質問・相談】: 「${promptText}」`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemInstruction + '\n\n' + userContent }] }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`APIエラー (Status: ${response.status})`);
    }

    const data = await response.json();
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(rawJson);

    const addedIds = this.state.addBatchNodes(parentId, parsed.nodes, 'ai', promptText);
    const replyText = parsed.summaryMessage || `「${parentNode.title}」について「${promptText}」への考察を整理しました。`;
    this.state.addMessage('ai', replyText, [parentId, ...addedIds]);

    return { addedIds, replyText };
  }

  /**
   * 内蔵インテリジェントエンジン（題材や質問に応じて本質的な思考対話と具体的回答ノードを生成）
   */
  generateSimulatedBatch(promptText, parentNode, parentId) {
    const text = promptText.toLowerCase();
    const topic = parentNode.title || 'このテーマ';
    let generatedItems = [];
    let replyMsg = '';

    // 0. 仕組み・機構・アーキテクチャへの問い
    if (text.includes('仕組み') || text.includes('しくみ') || text.includes('機構') || text.includes('アーキテクチャ') || text.includes('どう動く') || text.includes('構造') || text.includes('メカニズム')) {
      generatedItems = [
        {
          title: `自動ツリーレイアウト機構`,
          content: `${topic}でノード同士が重ならず、階層や子ノード数に応じて自動で美しい間隔を計算・配置する仕組み`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Mechanism'
        },
        {
          title: `リアルタイム双方向同期エンジン`,
          content: `チャットでの会話とツリー上のノードが瞬時に連動し、タップした会話やノードが相互に光ってフォーカスされる仕組み`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Mechanism'
        },
        {
          title: `IndexedDBオフライン完全永続化`,
          content: `通信ゼロの電波切れでも思考を止めず、ブラウザ内部ストレージへミリ秒単位で差分保存される安心の仕組み`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Mechanism'
        },
        {
          title: `スマートキーワード抽出・検索機構`,
          content: `ツリーが大きく広がっても、知りたいキーワードや思考の文脈を瞬時に探し出してフォーカスする仕組み`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Mechanism'
        }
      ];
      replyMsg = `「${topic}」についての「${promptText}」にお答えします！\n思考整理アプリを支える中核の仕組みとして、自動レイアウト機構、リアルタイム同期、オフライン完全保存、スマート検索の4つを展開しました！`;
    }
    // 1. アプリ連携・外部ツール・連携への問い
    else if (text.includes('連携') || text.includes('アプリ') || text.includes('ツール') || text.includes('api') || text.includes('connect')) {
      generatedItems = [
        {
          title: `Notion連携（ドキュメント蓄積）`,
          content: `${topic}で整理した思考ツリーやアイデアを、Notionページやデータベースへ1クリックで構造を保ったまま保存・蓄積する`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Solution'
        },
        {
          title: `Slack・Discord連携（チーム壁打ち）`,
          content: `決定したタスクや新しいアイデアをチームのチャンネルへ即時共有し、みんなでフィードバックや議論を回す`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Solution'
        },
        {
          title: `Googleカレンダー・Todo連携（即時実行）`,
          content: `ツリー内で決定したタスクノードを、期日やリマインダー付きで普段使いのTodoリストやカレンダーに自動同期する`,
          status: 'None',
          nodeType: 'Task',
          roleTag: 'Solution'
        },
        {
          title: `Obsidian・Markdown連携（ローカル同期）`,
          content: `手元のMarkdownファイルやVaultと双方向で同期し、ネット環境に関係なくローカル環境で思考を資産化する`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Solution'
        }
      ];
      replyMsg = `「${topic}」についての「${promptText}」にお答えします！\n思考整理アプリと特に相性が良く強力なのは、知識を蓄積するNotion/Obsidian、チームと共有するSlack/Discord、そして行動を即時カレンダー化するGoogleカレンダー/Todo連携です。それぞれの強みを活かした連携ノードを展開しました！`;
    }
    // 1. 想定ユーザー・ターゲット・ペルソナへの問い
    else if (text.includes('ユーザー') || text.includes('user') || text.includes('誰') || text.includes('ターゲット') || text.includes('対象') || text.includes('ペルソナ')) {
      generatedItems = [
        {
          title: `迷わず直感的に使いたい人`,
          content: `${topic}において、専門知識がなくても安心感を持って操作できる環境を求めるユーザー層`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Perspective'
        },
        {
          title: `素早く形にしたい実践者`,
          content: `${topic}の壁打ち相手としてAIを活用し、即座にタスクや仕様へ落とし込みたい開発者や企画者`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Perspective'
        },
        {
          title: `散らかった思考を俯瞰したい人`,
          content: `頭の中のモヤモヤをツリーで可視化し、客観的に整理・共有したいクリエイター`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Perspective'
        }
      ];
      replyMsg = `「${topic}」について想定されるユーザー像としては、迷わず使いたい初心者層、手早く形にしたい実践者層、思考を整理したいクリエイター層が考えられます。それぞれの目線に立った快適さを考慮しましょう。`;
    }
    // 2. 要件・機能・必要な仕様への問い
    else if (text.includes('要件') || text.includes('機能') || text.includes('必要') || text.includes('仕様')) {
      generatedItems = [
        {
          title: `思考を邪魔しない即座のノード化`,
          content: '思いついたことを瞬時に枝分かれさせて記録できるテンポの良い操作性',
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Ingenuity'
        },
        {
          title: `誤操作のない安心ボタンとUndo`,
          content: '削除や追加の押し間違いを防ぎ、間違えても一瞬で戻せる安全設計',
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Ingenuity'
        },
        {
          title: `会話とツリーの双方向同期`,
          content: 'チャットをタップすればノードへ、ノードを選べば会話へ相互にジャンプできる仕組み',
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Mechanism'
        }
      ];
      replyMsg = `「${topic}」を実現する要件として、思考を妨げない即時入力、押し間違いを防ぐ安心UI、そして思考の文脈をいつでも振り返れる双方向同期が核心になります。`;
    }
    // 3. どうやって・方法・アプローチへの問い
    else if (text.includes('どう') || text.includes('方法') || text.includes('やり方') || text.includes('アプローチ')) {
      generatedItems = [
        {
          title: `小さく試作して触る`,
          content: `${topic}の最小動作品をまず作り、実際に操作しながら肌感覚で確かめる`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Approach'
        },
        {
          title: `フィードバックの即時反映`,
          content: `使ってみて感じた違和感や押し間違いをその日のうちにコードへ反映して磨き上げる`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Approach'
        }
      ];
      replyMsg = `「${topic}」を進めるアプローチとしては、まずは最小構成でプロトタイプを動かし、手触りを確かめながら違和感を即日改善していく進め方が最も効果的です。`;
    }
    // 4. 具体例 (Example)
    else if (text.includes('具体例') || text.includes('シーン') || text.includes('example')) {
      generatedItems = [
        {
          title: `日常での活用シナリオ`,
          content: `${topic}を毎日の生活の中で自然に使う具体的な場面`,
          status: 'None',
          nodeType: 'Inspiration',
          roleTag: 'Perspective'
        },
        {
          title: `困ったときの解決事例`,
          content: `トラブルや悩みが生じた際に${topic}で乗り越える具体例`,
          status: 'None',
          nodeType: 'Fact',
          roleTag: 'Solution'
        }
      ];
      replyMsg = `「${topic}」の具体例として、日常の中で自然に手にとるシーンと、壁にぶつかった時に解決の糸口を見つける場面が想定されます。`;
    }
    // 5. なぜ？本質 (Why)
    else if (text.includes('なぜ') || text.includes('理由') || text.includes('目的') || text.includes('why')) {
      generatedItems = [
        {
          title: `達成したい本質的ゴール`,
          content: `${topic}を通じて最も実現したい核となる目的`,
          status: 'None',
          nodeType: 'Goal',
          roleTag: 'Goal'
        },
        {
          title: `心を動かした根本の情熱`,
          content: `なぜこれをやりたいと感じたのかという根本の情熱`,
          status: 'None',
          nodeType: 'Inspiration',
          roleTag: 'Inspiration'
        }
      ];
      replyMsg = `「${topic}」の根本にある動機は、迷いやストレスをなくし思考をクリアにすることです。原点を見失わずに進めましょう。`;
    }
    // 6. メリット・デメリット (Pros/Cons)
    else if (text.includes('メリット') || text.includes('デメリット') || text.includes('比較') || text.includes('pros')) {
      generatedItems = [
        {
          title: `主な強みと導入メリット`,
          content: `${topic}を採用することで得られる最大の価値や快適さ`,
          status: 'None',
          nodeType: 'Fact',
          roleTag: 'Ingenuity'
        },
        {
          title: `事前に考慮すべき注意点`,
          content: `事前に気をつけておくべきコストやリスク`,
          status: 'None',
          nodeType: 'Problem',
          roleTag: 'Problem'
        }
      ];
      replyMsg = `「${topic}」を採用すると直感的な使いやすさが向上する反面、情報量が増えたときの視認性や整理ルールへの配慮が必要です。`;
    }
    // 7. 結論・まとめる (Summarize)
    else if (text.includes('まとめ') || text.includes('結論') || text.includes('summarize')) {
      generatedItems = [
        {
          title: `最優先でフォーカスする重要結論`,
          content: `これまでの議論をふまえ、今最優先でフォーカスすべき結論`,
          status: 'Adopted',
          nodeType: 'Goal',
          roleTag: 'Approach'
        }
      ];
      replyMsg = `「${topic}」の総括として、まずは最も重要で核となる一歩に焦点を絞って進めていくことが最優先事項です。`;
    }
    // 8. タスク化
    else if (text.includes('タスク') || text.includes('ステップ') || text.includes('taskify')) {
      generatedItems = [
        {
          title: `現状の整理と前提条件の確認`,
          content: '必要な情報を集め、前提条件を固める',
          status: 'None',
          nodeType: 'Task',
          roleTag: 'Verification'
        },
        {
          title: `最小プロトタイプの試作`,
          content: 'まずは小さく試作品を作って感触を掴む',
          status: 'None',
          nodeType: 'Task',
          roleTag: 'Verification'
        },
        {
          title: `実機での動作検証とブラッシュアップ`,
          content: '触ってみて気になる点をブラッシュアップする',
          status: 'None',
          nodeType: 'Task',
          roleTag: 'Verification'
        }
      ];
      replyMsg = `「${topic}」を着実に進めるため、準備・試作・検証の3つのステップで段階的に取り組みましょう。`;
    }
    // 9. 課題・リスク
    else if (text.includes('課題') || text.includes('リスク') || text.includes('problem')) {
      generatedItems = [
        {
          title: `直感的な操作性の確保`,
          content: '誰でも迷わず直感的に使えるかどうかの検証が必要',
          status: 'None',
          nodeType: 'Problem',
          roleTag: 'Problem'
        },
        {
          title: `オフライン完全永続化の保証`,
          content: 'ブラウザを閉じても消えない安心設計の確保',
          status: 'None',
          nodeType: 'Problem',
          roleTag: 'Mechanism'
        }
      ];
      replyMsg = `「${topic}」で想定される懸念として、操作の直感性と大切なデータの確実な保持が重要ポイントとなります。`;
    }
    // 10. 広げる (Expand)
    else if (text.includes('広げ') || text.includes('アイデア') || text.includes('expand')) {
      generatedItems = [
        {
          title: `使う人の心地よさ`,
          content: 'ミル造さんスタイルのやさしいデザインと親しみやすい操作性',
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Perspective'
        },
        {
          title: `外部ツール連携`,
          content: 'NotionやObsidianへのスムーズな書き出しとデータ共有',
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Perspective'
        },
        {
          title: `音声・タッチ快適操作`,
          content: 'スマホでも片手でサクサク思考整理できる工夫',
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Perspective'
        }
      ];
      replyMsg = `「${topic}」の可能性として、使う人の心地よさ、外部ツールとの連携、そして快適な操作感の3つの視点から展開できます。`;
    }
    // 11. デザイン・UI・見た目
    else if (text.includes('デザイン') || text.includes('ui') || text.includes('ux') || text.includes('見た目') || text.includes('画面') || text.includes('レイアウト')) {
      generatedItems = [
        {
          title: `余白を活かしたミニマルUI`,
          content: `${topic}で情報が溢れても圧迫感を与えないよう、余白と穏やかな配色で思考に集中できるビジュアル`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Ingenuity'
        },
        {
          title: `スマホでの親指片手操作ナビ`,
          content: `片手で歩きながらでも思いついた瞬間にメモやツリー展開ができる快適な操作動線`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Ingenuity'
        },
        {
          title: `ドラッグ＆ドロップの心地よい触感`,
          content: `ノードを動かしたときに心地よい吸着感やアニメーションをつけ、触っていて楽しくなる設計`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Ingenuity'
        }
      ];
      replyMsg = `「${topic}」のデザイン・UIとして、思考を妨げないミニマルな余白設計、スマホでも迷わない片手操作、そして触っていて気持ち良いインタラクションをご提案します！`;
    }
    // 12. 保存・データ・オフライン
    else if (text.includes('保存') || text.includes('データ') || text.includes('db') || text.includes('ストレージ') || text.includes('オフライン') || text.includes('同期')) {
      generatedItems = [
        {
          title: `IndexedDB超高速ローカル保存`,
          content: `数千ノードの大規模ツリーでも一瞬で読み書きでき、通信ゼロでも思考を止めないオフライン完全保証`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Mechanism'
        },
        {
          title: `クラウド自動バックアップ連携`,
          content: `PCとスマホの間でデータをシームレスに同期し、万が一の端末故障時も大切な思考資産を守る`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Mechanism'
        },
        {
          title: `Markdown / JSON自由エクスポート`,
          content: `特定のツールに依存せず、いつでも自分のデータを丸ごと手元に取り出せるオープンな安心感`,
          status: 'None',
          nodeType: 'Task',
          roleTag: 'Solution'
        }
      ];
      replyMsg = `「${topic}」のデータ保存として、電波が切れても瞬時に動くローカル保存、複数端末で使えるクラウド同期、いつでも手元に取り出せる自由なエクスポート機能をご提案します！`;
    }
    // 13. その他の自由入力・汎用質問（タイトルは純粋な要約のみ！役割・性質はタグとして登録！）
    else {
      // 助詞や疑問詞をきれいに取り除いて問いの核心キーワードを抽出
      let cleaned = promptText
        .replace(/[？\?]|ですか|ますか|でしょうか|とは|について|を教えて|どうすれば|何が|どんな|おすすめ|強力|効果的|最適/g, '')
        .trim();
      if (!cleaned) cleaned = topic;

      generatedItems = [
        {
          title: `${cleaned}の自動化・仕組み化`,
          content: `「${promptText}」への具体的な解として、手動の手間を極力なくしスムーズに流れる仕組みを構築する`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Solution'
        },
        {
          title: `${cleaned}の直感的なUI設計`,
          content: `初心者でも迷わず、1秒で理解して使えるようシンプルで親しみやすいインターフェースにする`,
          status: 'None',
          nodeType: 'Idea',
          roleTag: 'Ingenuity'
        },
        {
          title: `${cleaned}の試作と使い心地テスト`,
          content: `まずは最小構成でプロトタイプを作り、実際の操作感や使い勝手を確かめる実践ステップ`,
          status: 'None',
          nodeType: 'Task',
          roleTag: 'Verification'
        }
      ];
      replyMsg = `「${topic}」についての「${promptText}」にお答えします！\n核心となるアプローチとして仕組み化・自動化の導入、迷いをなくす直感的な工夫、そして実用性を高める検証ステップをご提案します。それぞれの具体的なノードを展開しました！`;
    }

    const addedIds = this.state.addBatchNodes(parentId, generatedItems, 'ai', promptText);
    this.state.addMessage('ai', replyMsg, [parentId, ...addedIds]);

    return { addedIds, replyText: replyMsg };
  }

  /**
   * 🌟 自然文・会議ログ・ChatGPT会話文からGeminiでマインドマップ階層構造（JSON）を抽出
   * @param {string} rawText 入力テキスト
   * @returns {Promise<Object>} 階層ツリーオブジェクト
   */
  async extractMindMapFromText(rawText) {
    if (!rawText || !rawText.trim()) return null;
    const apiKey = this.state.data.settings?.geminiApiKey;
    const model = this.state.data.settings?.geminiModel || 'gemini-3.6-flash';

    if (apiKey && apiKey.trim().length > 10) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const prompt = `以下のテキスト（会議議事録、ChatGPTの会話ログ、ブレインストーミングメモなど）を詳細に分析し、
思考マインドマップ用の階層ツリー構造（JSON）を構築してください。

【テキスト】:
${rawText}

【厳格な出力フォーマット（JSON形式のみ）】:
必ず以下の構造を持つJSONオブジェクトのみを出力してください（マークダウンの\`\`\`jsonブロック等も可）：
{
  "title": "全体のメインテーマ（20文字以内）",
  "content": "全体の総括・要約メモ",
  "nodeType": "Goal",
  "status": "None",
  "tags": ["AI抽出"],
  "children": [
    {
      "title": "主要トピック1（15文字以内、簡潔な要約）",
      "content": "詳細メモや補足説明",
      "nodeType": "Idea",
      "status": "None",
      "tags": [],
      "children": [
        {
          "title": "サブトピック（15文字以内）",
          "content": "詳細・理由など",
          "nodeType": "Task",
          "status": "None",
          "children": []
        }
      ]
    }
  ]
}
※ノードのタイトルは絵文字を含めず、簡潔で本質を突いた日本語フレーズにしてください。
※nodeTypeは Goal, Idea, Task, Problem, Fact, Question, Inspiration, Reference から選択してください。`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.3
            }
          })
        });

        if (response.ok) {
          const resData = await response.json();
          const candidateText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed.title) return parsed;
          }
        }
      } catch (e) {
        console.warn('AI構造化APIエラー、ローカルルールベースでパース:', e);
      }
    }

    // APIキーがない場合またはエラー時のローカルフォールバック
    return this.fallbackExtractMindMap(rawText);
  }

  /**
   * 🛡️ APIキーがない場合のローカル階層抽出フォールバック
   */
  fallbackExtractMindMap(rawText) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    const firstLine = lines[0].replace(/^[#\-*\d.]+\s*/, '').substring(0, 30);
    const rootTitle = firstLine || 'インポート思考テーマ';

    const children = [];
    for (let i = 1; i < Math.min(lines.length, 8); i++) {
      const line = lines[i];
      if (line.length < 2) continue;
      const cleanLine = line.replace(/^[#\-*\d.]+\s*/, '');
      const parts = cleanLine.split(/[:：、。]/);
      const title = parts[0].substring(0, 20);
      const content = parts.slice(1).join(' ').trim();
      children.push({
        title: title || cleanLine.substring(0, 20),
        content: content || cleanLine,
        nodeType: 'Idea',
        status: 'None',
        tags: [],
        children: []
      });
    }

    return {
      title: rootTitle,
      content: 'テキストから自動抽出された思考マップです。',
      nodeType: 'Goal',
      status: 'None',
      tags: ['自動生成'],
      children: children.length > 0 ? children : [{ title: '主要論点', content: rawText.substring(0, 100), nodeType: 'Idea', children: [] }]
    };
  }
}

window.AIEngine = AIEngine;
