import JSZip from 'jszip';
import { db } from '../db/index';
import { quizzes, questions, choices } from '../db/schema/index';
import { eq, inArray } from 'drizzle-orm';
import { ScormExportConfig, ChoiceId } from '@quiz-forge/shared';

export class ScormError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'ScormError';
  }
}

interface ExportQuizData {
  quiz: {
    id: string;
    topic: string;
    difficulty: string;
    questionCount: number;
  };
  questions: Array<{
    id: string;
    order: number;
    text: string;
    correctChoiceId: ChoiceId;
    explanation: string;
    choices: Array<{
      choiceId: ChoiceId;
      text: string;
    }>;
  }>;
}

export class ScormService {
  /**
   * Fetches canonical quiz data with questions and choices.
   */
  async getQuizExportData(quizId: string, database = db): Promise<ExportQuizData> {
    const quiz = database
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .get();

    if (!quiz) {
      throw new ScormError('Quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    const quizQuestions = database
      .select()
      .from(questions)
      .where(eq(questions.quizId, quizId))
      .all();

    if (quizQuestions.length === 0) {
      throw new ScormError('Quiz has no questions to export.', 400, 'EMPTY_QUIZ');
    }

    const qIds = quizQuestions.map((q) => q.id);
    const questionChoices = database
      .select()
      .from(choices)
      .where(inArray(choices.questionId, qIds))
      .all();

    const choicesByQuestion = new Map<string, Array<{ choiceId: ChoiceId; text: string }>>();
    for (const c of questionChoices) {
      const list = choicesByQuestion.get(c.questionId) || [];
      list.push({
        choiceId: c.choiceId as ChoiceId,
        text: c.optionText,
      });
      choicesByQuestion.set(c.questionId, list);
    }

    const formattedQuestions = quizQuestions
      .sort((a, b) => a.questionOrder - b.questionOrder)
      .map((q) => ({
        id: q.id,
        order: q.questionOrder,
        text: q.questionText,
        correctChoiceId: q.correctChoiceId as ChoiceId,
        explanation: q.explanation,
        choices: (choicesByQuestion.get(q.id) || []).sort((a, b) =>
          a.choiceId.localeCompare(b.choiceId)
        ),
      }));

    return {
      quiz: {
        id: quiz.id,
        topic: quiz.topic,
        difficulty: quiz.difficulty,
        questionCount: formattedQuestions.length,
      },
      questions: formattedQuestions,
    };
  }

  /**
   * Builds the imsmanifest.xml for SCORM 1.2 or SCORM 2004.
   */
  buildManifestXml(quizData: ExportQuizData, config: ScormExportConfig): string {
    const safeTitle = this.escapeXml(quizData.quiz.topic);
    const is2004 = config.scormVersion === '2004_4th';
    const isXapi = config.scormVersion === 'xapi';

    if (is2004) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="QuizForge_Manifest_${quizData.quiz.id}" version="1.0"
          xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
          xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
          xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
          xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
                              http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd
                              http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="org_quizforge">
    <organization identifier="org_quizforge">
      <title>${safeTitle}</title>
      <item identifier="item_quiz" identifierref="res_quiz">
        <title>${safeTitle}</title>
        <imsss:sequencing>
          <imsss:deliveryControls completionSetByContent="true" objectiveSetByContent="true" />
        </imsss:sequencing>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res_quiz" type="webcontent" adlcp:scormType="sco" href="index.html">
      <file href="index.html" />
    </resource>
  </resources>
</manifest>`;
    }

    if (isXapi) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<tincan xmlns="http://projecttincan.com/tincan.xsd">
  <activities>
    <activity id="http://quizforge.app/activities/${quizData.quiz.id}" type="http://adlnet.gov/expapi/activities/assessment">
      <name lang="en-US">${safeTitle}</name>
      <description lang="en-US">QuizForge interactive assessment for ${safeTitle}</description>
      <launch lang="en-US">index.html</launch>
    </activity>
  </activities>
</tincan>`;
    }

    // Default: SCORM 1.2
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="QuizForge_Manifest_${quizData.quiz.id}" version="1.2"
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                              http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org_quizforge">
    <organization identifier="org_quizforge">
      <title>${safeTitle}</title>
      <item identifier="item_quiz" identifierref="res_quiz">
        <title>${safeTitle}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res_quiz" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html" />
    </resource>
  </resources>
</manifest>`;
  }

  /**
   * Generates self-contained interactive player HTML with embedded SCORM/xAPI runtime.
   */
  buildPlayerHtml(quizData: ExportQuizData, config: ScormExportConfig): string {
    const quizJson = JSON.stringify(quizData);
    const configJson = JSON.stringify(config);
    const safeTopic = this.escapeXml(quizData.quiz.topic);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTopic} - QuizForge Assessment</title>
  <style>
    :root {
      --primary: #1935CA;
      --primary-hover: #142BA3;
      --bg: #F8F9FC;
      --card-bg: #FFFFFF;
      --text: #1E293B;
      --muted: #64748B;
      --border: #E2E8F0;
      --success: #10B981;
      --error: #EF4444;
      --accent: #EEF2FF;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0B0F19;
        --card-bg: #151C2C;
        --text: #F8FAFC;
        --muted: #94A3B8;
        --border: #1E293B;
        --accent: #1935CA20;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; }
    header { background: var(--card-bg); border-bottom: 1px solid var(--border); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 10; }
    .brand { font-size: 14px; font-weight: 800; color: var(--primary); display: flex; align-items: center; gap: 8px; }
    .badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; background: var(--accent); color: var(--primary); }
    main { max-width: 760px; width: 100%; margin: 24px auto; padding: 0 16px; flex: 1; }
    .progress-bar-bg { width: 100%; height: 8px; background: var(--border); border-radius: 9999px; overflow: hidden; margin-bottom: 24px; }
    .progress-bar-fill { height: 100%; background: var(--primary); transition: width 0.3s ease; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 20px; padding: 28px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); margin-bottom: 20px; }
    .q-step { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--primary); margin-bottom: 12px; }
    .q-text { font-size: 18px; font-weight: 700; line-height: 1.4; margin-bottom: 24px; }
    .options { display: flex; flex-direction: column; gap: 12px; }
    .option-btn { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-radius: 14px; border: 1px solid var(--border); background: var(--card-bg); color: var(--text); cursor: pointer; text-align: left; transition: all 0.2s; font-size: 14px; }
    .option-btn:hover { border-color: var(--primary); background: var(--accent); }
    .option-btn.selected { border-color: var(--primary); background: var(--accent); font-weight: 700; }
    .opt-letter { width: 28px; height: 28px; border-radius: 8px; background: var(--border); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; flex-shrink: 0; }
    .option-btn.selected .opt-letter { background: var(--primary); color: white; }
    .nav-row { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; }
    .btn { padding: 12px 24px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; transition: 0.2s; display: inline-flex; align-items: center; gap: 6px; }
    .btn-secondary { background: var(--card-bg); border: 1px solid var(--border); color: var(--text); }
    .btn-primary { background: var(--primary); color: #FFF; box-shadow: 0 4px 14px rgba(25, 53, 202, 0.2); }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .results-card { text-align: center; padding: 40px 24px; }
    .score-circle { width: 110px; height: 110px; border-radius: 50%; margin: 0 auto 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; }
    .score-pass { background: #10B98115; border: 3px solid var(--success); color: var(--success); }
    .score-fail { background: #EF444415; border: 3px solid var(--error); color: var(--error); }
    .explanation { margin-top: 14px; padding: 12px 16px; border-radius: 12px; background: var(--accent); font-size: 12px; line-height: 1.5; color: var(--text); }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
      <span>QuizForge SCORM Assessment</span>
    </div>
    <div id="lmsStatusBadge" class="badge">Standalone Mode</div>
  </header>

  <main id="app">
    <div class="progress-bar-bg">
      <div id="progressBar" class="progress-bar-fill" style="width: 0%;"></div>
    </div>

    <div id="quizContainer" class="card">
      <div id="questionStep" class="q-step">Question 1 of 1</div>
      <div id="questionText" class="q-text">Loading assessment...</div>
      <div id="optionsContainer" class="options"></div>

      <div class="nav-row">
        <button id="prevBtn" class="btn btn-secondary">Previous</button>
        <button id="nextBtn" class="btn btn-primary">Next Question</button>
      </div>
    </div>

    <div id="resultsContainer" class="card results-card" style="display: none;">
      <div id="scoreCircle" class="score-circle">
        <span id="scoreText" style="font-size: 32px;">0%</span>
        <span style="font-size: 10px; text-transform: uppercase;">Score</span>
      </div>
      <h2 id="resultTitle" style="font-size: 22px; font-weight: 800; margin-bottom: 8px;">Assessment Completed</h2>
      <p id="resultDesc" style="font-size: 14px; color: var(--muted); margin-bottom: 24px;"></p>
      <div id="reviewContainer" style="text-align: left; margin-top: 24px;"></div>
    </div>
  </main>

  <script>
    const QUIZ_DATA = ${quizJson};
    const CONFIG = ${configJson};

    // SCORM API Adapter Detection
    let scormApi = null;
    let scormVersion = CONFIG.scormVersion || '1.2';

    function findAPI(win) {
      let findAttempts = 0;
      while ((!win.API && !win.API_1484_11) && (win.parent) && (win.parent !== win) && (findAttempts <= 10)) {
        findAttempts++;
        win = win.parent;
      }
      return win.API_1484_11 || win.API || null;
    }

    function initScorm() {
      scormApi = findAPI(window);
      const badge = document.getElementById('lmsStatusBadge');
      if (scormApi) {
        if (scormApi.LMSInitialize) {
          scormApi.LMSInitialize("");
          badge.textContent = "LMS Connected (SCORM 1.2)";
        } else if (scormApi.Initialize) {
          scormApi.Initialize("");
          badge.textContent = "LMS Connected (SCORM 2004)";
        }
      } else {
        badge.textContent = "Standalone Mode (No LMS)";
      }
    }

    let currentIndex = 0;
    const userAnswers = {};
    const startTime = Date.now();

    function renderQuestion(idx) {
      const q = QUIZ_DATA.questions[idx];
      const total = QUIZ_DATA.questions.length;
      document.getElementById('questionStep').textContent = 'Question ' + (idx + 1) + ' of ' + total;
      document.getElementById('questionText').textContent = q.text;
      document.getElementById('progressBar').style.width = (((idx + 1) / total) * 100) + '%';

      const optionsBox = document.getElementById('optionsContainer');
      optionsBox.innerHTML = '';

      q.choices.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'option-btn' + (userAnswers[q.id] === c.choiceId ? ' selected' : '');
        btn.innerHTML = '<span class="opt-letter">' + c.choiceId + '</span><span>' + c.text + '</span>';
        btn.onclick = () => {
          userAnswers[q.id] = c.choiceId;
          renderQuestion(idx);
        };
        optionsBox.appendChild(btn);
      });

      document.getElementById('prevBtn').disabled = idx === 0;
      const nextBtn = document.getElementById('nextBtn');
      if (idx === total - 1) {
        nextBtn.textContent = 'Submit Assessment';
      } else {
        nextBtn.textContent = 'Next Question';
      }
    }

    document.getElementById('prevBtn').onclick = () => {
      if (currentIndex > 0) {
        currentIndex--;
        renderQuestion(currentIndex);
      }
    };

    document.getElementById('nextBtn').onclick = () => {
      if (currentIndex < QUIZ_DATA.questions.length - 1) {
        currentIndex++;
        renderQuestion(currentIndex);
      } else {
        finishQuiz();
      }
    };

    function finishQuiz() {
      let correct = 0;
      const total = QUIZ_DATA.questions.length;

      QUIZ_DATA.questions.forEach((q, i) => {
        const isCorrect = userAnswers[q.id] === q.correctChoiceId;
        if (isCorrect) correct++;

        // Track interactions if enabled and LMS connected
        if (CONFIG.trackInteractions && scormApi) {
          if (scormApi.LMSSetValue) { // SCORM 1.2
            scormApi.LMSSetValue('cmi.interactions.' + i + '.id', q.id);
            scormApi.LMSSetValue('cmi.interactions.' + i + '.type', 'choice');
            scormApi.LMSSetValue('cmi.interactions.' + i + '.student_response', userAnswers[q.id] || '');
            scormApi.LMSSetValue('cmi.interactions.' + i + '.result', isCorrect ? 'correct' : 'wrong');
          } else if (scormApi.SetValue) { // SCORM 2004
            scormApi.SetValue('cmi.interactions.' + i + '.id', q.id);
            scormApi.SetValue('cmi.interactions.' + i + '.type', 'choice');
            scormApi.SetValue('cmi.interactions.' + i + '.learner_response', userAnswers[q.id] || '');
            scormApi.SetValue('cmi.interactions.' + i + '.result', isCorrect ? 'correct' : 'incorrect');
          }
        }
      });

      const percentage = Math.round((correct / total) * 100);
      const isPassed = percentage >= (CONFIG.passingScorePercentage || 70);

      // Report to SCORM LMS
      if (scormApi) {
        if (scormApi.LMSSetValue) { // SCORM 1.2
          scormApi.LMSSetValue('cmi.core.score.raw', percentage.toString());
          scormApi.LMSSetValue('cmi.core.score.min', '0');
          scormApi.LMSSetValue('cmi.core.score.max', '100');
          scormApi.LMSSetValue('cmi.core.lesson_status', isPassed ? (CONFIG.masteryStatusOnPassing || 'passed') : 'failed');
          scormApi.LMSCommit("");
          scormApi.LMSFinish("");
        } else if (scormApi.SetValue) { // SCORM 2004
          scormApi.SetValue('cmi.score.raw', percentage.toString());
          scormApi.SetValue('cmi.score.scaled', (percentage / 100).toFixed(4));
          scormApi.SetValue('cmi.success_status', isPassed ? 'passed' : 'failed');
          scormApi.SetValue('cmi.completion_status', 'completed');
          scormApi.Commit("");
          scormApi.Terminate("");
        }
      }

      // Display UI Results
      document.getElementById('quizContainer').style.display = 'none';
      document.getElementById('resultsContainer').style.display = 'block';

      const circle = document.getElementById('scoreCircle');
      circle.className = 'score-circle ' + (isPassed ? 'score-pass' : 'score-fail');
      document.getElementById('scoreText').textContent = percentage + '%';

      document.getElementById('resultTitle').textContent = isPassed ? 'Assessment Passed!' : 'Assessment Incomplete';
      document.getElementById('resultDesc').textContent = 'You answered ' + correct + ' out of ' + total + ' questions correctly (' + percentage + '%). Minimum passing threshold: ' + (CONFIG.passingScorePercentage || 70) + '%.';

      if (CONFIG.includeExplanations) {
        const reviewBox = document.getElementById('reviewContainer');
        reviewBox.innerHTML = '<h3 style="font-size: 16px; font-weight: 800; margin-bottom: 16px;">Detailed Review:</h3>';
        QUIZ_DATA.questions.forEach((q, idx) => {
          const userChoice = userAnswers[q.id];
          const isRight = userChoice === q.correctChoiceId;
          const itemDiv = document.createElement('div');
          itemDiv.style.marginBottom = '16px';
          itemDiv.style.padding = '14px';
          itemDiv.style.borderRadius = '12px';
          itemDiv.style.border = '1px solid ' + (isRight ? '#10B98140' : '#EF444440');
          itemDiv.style.background = isRight ? '#10B98108' : '#EF444408';
          itemDiv.innerHTML = '<div style="font-size: 13px; font-weight: 700; margin-bottom: 6px;">Q' + (idx + 1) + ': ' + q.text + '</div>' +
            '<div style="font-size: 12px;">Your Answer: <strong>' + (userChoice || 'Unanswered') + '</strong> | Correct: <strong style="color: #10B981;">' + q.correctChoiceId + '</strong></div>' +
            (q.explanation ? '<div class="explanation"><strong>Explanation:</strong> ' + q.explanation + '</div>' : '');
          reviewBox.appendChild(itemDiv);
        });
      }
    }

    // Startup
    initScorm();
    renderQuestion(0);
  </script>
</body>
</html>`;
  }

  /**
   * Generates a fully packaged, zip-compressed SCORM bundle.
   */
  async exportScormPackage(
    quizId: string,
    config: ScormExportConfig,
    database = db
  ): Promise<{ filename: string; buffer: Buffer; mimeType: string }> {
    const quizData = await this.getQuizExportData(quizId, database);

    const zip = new JSZip();

    // 1. Manifest
    const manifestXml = this.buildManifestXml(quizData, config);
    if (config.scormVersion === 'xapi') {
      zip.file('tincan.xml', manifestXml);
    } else {
      zip.file('imsmanifest.xml', manifestXml);
    }

    // 2. Self-contained HTML Player
    const playerHtml = this.buildPlayerHtml(quizData, config);
    zip.file('index.html', playerHtml);

    // 3. Metadata Descriptor
    const metaDescriptor = {
      packageGenerator: 'QuizForge SCORM/xAPI Exporter',
      version: config.scormVersion,
      quizId: quizData.quiz.id,
      topic: quizData.quiz.topic,
      totalQuestions: quizData.quiz.questionCount,
      passingScorePercentage: config.passingScorePercentage,
      exportedAt: new Date().toISOString(),
    };
    zip.file('quizforge-meta.json', JSON.stringify(metaDescriptor, null, 2));

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    const safeTopic = quizData.quiz.topic.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `QuizForge-SCORM-${config.scormVersion}-${safeTopic}.zip`;

    return {
      filename,
      buffer,
      mimeType: 'application/zip',
    };
  }

  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const scormService = new ScormService();
