import { useState, useEffect, useMemo, useRef } from "react";

import "./App.css";



// Utilities & Database

import {

  STORE_NAME,

  VERBS_STORE_NAME,

  PATTERNS_STORE_NAME,

  PREPOSITIONS_STORE_NAME,

  TIME_STORE_NAME,

  BACKUP_KEY,

  VERBS_BACKUP_KEY,

  PATTERNS_BACKUP_KEY,

  PREPOSITIONS_BACKUP_KEY,

  TIME_BACKUP_KEY,

  loadFromVaultDB,

  writeToVaultDB,

} from "./utils/db";

import {

  requestMobileNotificationPermission,

  startHourlyNounNotifier,

} from "./utils/hourlyWordNotifier";

import { calculateStreak } from "./utils/streakHelper";



// Constants

import {

  SEED_DATA,

  SEED_VERBS,

  SEED_PATTERNS,

  SEED_PREPOSITIONS,

  SEED_TIME,

} from "./constants/seedData";

import { GRAMMAR_TOPICS } from "./constants/grammarData";



// Shared UI Components

import Header from "./components/Header";

import Sidebar from "./components/Sidebar";

import SubTabs from "./components/SubTabs";

import ConfirmModal from "./components/ConfirmModal";

import GoalModal from "./components/GoalModal";

import ReportModal from "./components/ReportModal";

import StreakMilestoneModal from "./components/StreakMilestoneModal"; // 👈 Import milestone modal



// Pages

import NounsPage from "./pages/NounsPage";

import VerbsPage from "./pages/VerbsPage";

import PatternsPage from "./pages/PatternsPage";

import PrepositionsPage from "./pages/PrepositionsPage";

import TimePage from "./pages/TimePage";

import GrammarPage from "./pages/GrammarPage";



export default function App() {

  const [vocabList, setVocabList] = useState([]);

  const [verbsList, setVerbsList] = useState([]);

  const [patternsList, setPatternsList] = useState([]);

  const [prepsList, setPrepsList] = useState([]);

  const [timeList, setTimeList] = useState([]);

  const [isReady, setIsReady] = useState(false);



  const [theme] = useState(() => localStorage.getItem("vocab_vault_theme") || "light");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [goalModalOpen, setGoalModalOpen] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);



  // Milestone modal state

  const [milestoneStreak, setMilestoneStreak] = useState(null);



  const [languageMode, setLanguageMode] = useState("EN");

  const [mainCategory, setMainCategory] = useState("Nouns");



  const [subViews, setSubViews] = useState({

    Nouns: "list",

    Patterns: "list",

    Verbs: "list",

    Prepositions: "list",

    Time: "list",

    Grammar: "list",

  });



  const [confirmModal, setConfirmModal] = useState({

    isOpen: false,

    title: "",

    message: "",

    onConfirm: () => {},

  });



  // Calculate day-to-day streak

  const streakData = useMemo(() => {

    return calculateStreak({

      Nouns: vocabList,

      Verbs: verbsList,

      Patterns: patternsList,

      Prepositions: prepsList,

      Time: timeList,

    });

  }, [vocabList, verbsList, patternsList, prepsList, timeList]);



  // Check for 5-day milestone triggers (5, 10, 15, 20...)

  useEffect(() => {

    if (!isReady) return;

    const currentStreak = streakData.streak;



    if (currentStreak > 0 && currentStreak % 5 === 0 && streakData.activeToday) {

      const lastCelebrated = Number(localStorage.getItem("last_celebrated_streak") || 0);



      // Only trigger if this specific milestone hasn't been shown yet

      if (lastCelebrated < currentStreak) {

        setMilestoneStreak(currentStreak);

        localStorage.setItem("last_celebrated_streak", String(currentStreak));

      }

    }

  }, [streakData, isReady]);



  // Daily & weekly progress calculations

  const categoryStats = useMemo(() => {

    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const dayOfWeek = now.getDay();

    const distanceToMonday = (dayOfWeek + 6) % 7;

    const startOfWeek = new Date(

      now.getFullYear(),

      now.getMonth(),

      now.getDate() - distanceToMonday

    ).getTime();



    const getStats = (list) => {

      let daily = 0;

      let weekly = 0;

      (list || []).forEach((item) => {

        const time = item.createdAt ? new Date(item.createdAt).getTime() : 0;

        if (time >= startOfToday) daily += 1;

        if (time >= startOfWeek) weekly += 1;

      });

      return { dailyCurrent: daily, weeklyCurrent: weekly };

    };



    return {

      Nouns: getStats(vocabList),

      Verbs: getStats(verbsList),

      Patterns: getStats(patternsList),

      Prepositions: getStats(prepsList),

      Time: getStats(timeList),

    };

  }, [vocabList, verbsList, patternsList, prepsList, timeList]);



  const requestConfirmation = (title, message, onConfirm) => {

    setConfirmModal({

      isOpen: true,

      title,

      message,

      onConfirm: () => {

        onConfirm();

        setConfirmModal((prev) => ({ ...prev, isOpen: false }));

      },

    });

  };



  useEffect(() => {

    async function initVault() {

      try {

        // 1. Verbs

        let storedVerbs = await loadFromVaultDB(VERBS_STORE_NAME, VERBS_BACKUP_KEY);

        const needsVerbMigration =

          !storedVerbs || storedVerbs.some((v) => v.preterite === undefined || !v.createdAt);



        if (needsVerbMigration) {

          const mergedVerbs =

            storedVerbs && storedVerbs.length > 0

              ? storedVerbs.map((existing) => {

                  const seedMatch = SEED_VERBS.find(

                    (s) => s.verb === existing.verb || s.id === existing.id

                  );

                  return {

                    ...existing,

                    preterite: existing.preterite || (seedMatch ? seedMatch.preterite : ""),

                    participle: existing.participle || (seedMatch ? seedMatch.participle : ""),

                    auxiliary: existing.auxiliary || (seedMatch ? seedMatch.auxiliary : "hat"),

                    createdAt:

                      existing.createdAt ||

                      (seedMatch ? seedMatch.createdAt : new Date().toISOString()),

                  };

                })

              : SEED_VERBS;



          await writeToVaultDB(VERBS_STORE_NAME, VERBS_BACKUP_KEY, mergedVerbs);

          setVerbsList(mergedVerbs);

        } else {

          setVerbsList(storedVerbs);

        }



        // 2. Nouns

        let storedVocab = await loadFromVaultDB(STORE_NAME, BACKUP_KEY);

        if (!storedVocab || storedVocab.some((n) => !n.createdAt)) {

          const merged =

            storedVocab && storedVocab.length

              ? storedVocab.map((item) => {

                  const match = SEED_DATA.find((s) => s.id === item.id);

                  return {

                    ...item,

                    createdAt: item.createdAt || (match ? match.createdAt : new Date().toISOString()),

                  };

                })

              : SEED_DATA;

          await writeToVaultDB(STORE_NAME, BACKUP_KEY, merged);

          setVocabList(merged);

        } else {

          setVocabList(storedVocab);

        }



        // 3. Patterns

        let storedPatterns = await loadFromVaultDB(PATTERNS_STORE_NAME, PATTERNS_BACKUP_KEY);

        if (!storedPatterns || storedPatterns.some((p) => !p.createdAt)) {

          const merged =

            storedPatterns && storedPatterns.length

              ? storedPatterns.map((item) => {

                  const match = SEED_PATTERNS.find((s) => s.id === item.id);

                  return {

                    ...item,

                    createdAt: item.createdAt || (match ? match.createdAt : new Date().toISOString()),

                  };

                })

              : SEED_PATTERNS;

          await writeToVaultDB(PATTERNS_STORE_NAME, PATTERNS_BACKUP_KEY, merged);

          setPatternsList(merged);

        } else {

          setPatternsList(storedPatterns);

        }



        // 4. Prepositions

        let storedPreps = await loadFromVaultDB(PREPOSITIONS_STORE_NAME, PREPOSITIONS_BACKUP_KEY);

        if (!storedPreps || storedPreps.some((p) => !p.createdAt)) {

          const merged =

            storedPreps && storedPreps.length

              ? storedPreps.map((item) => {

                  const match = SEED_PREPOSITIONS.find((s) => s.id === item.id);

                  return {

                    ...item,

                    createdAt: item.createdAt || (match ? match.createdAt : new Date().toISOString()),

                  };

                })

              : SEED_PREPOSITIONS;

          await writeToVaultDB(PREPOSITIONS_STORE_NAME, PREPOSITIONS_BACKUP_KEY, merged);

          setPrepsList(merged);

        } else {

          setPrepsList(storedPreps);

        }



        // 5. Time

        let storedTimes = await loadFromVaultDB(TIME_STORE_NAME, TIME_BACKUP_KEY);

        if (!storedTimes || storedTimes.length === 0) {

          await writeToVaultDB(TIME_STORE_NAME, TIME_BACKUP_KEY, SEED_TIME);

          setTimeList(SEED_TIME);

        } else {

          setTimeList(storedTimes);

        }

      } catch (err) {

        console.error("IndexedDB initialization error:", err);

        setVerbsList(SEED_VERBS);

        setVocabList(SEED_DATA);

        setPatternsList(SEED_PATTERNS);

        setPrepsList(SEED_PREPOSITIONS);

        setTimeList(SEED_TIME);

      } finally {

        setIsReady(true);

      }

    }



    initVault();

  }, []);



  // ---------------------------------------------------------------

  // Hourly noun notifier

  // ---------------------------------------------------------------

  const vocabRef = useRef(vocabList);

  useEffect(() => {

    vocabRef.current = vocabList;

  }, [vocabList]);



  const [notifPermission, setNotifPermission] = useState(

    typeof Notification !== "undefined" ? Notification.permission : "unsupported"

  );



  useEffect(() => {

    const id = startHourlyNounNotifier(() => vocabRef.current);

    return () => clearInterval(id);

  }, []);



  const handleEnableNotifications = async () => {

    const granted = await requestMobileNotificationPermission();

    setNotifPermission(

      granted

        ? "granted"

        : typeof Notification !== "undefined"

        ? Notification.permission

        : "unsupported"

    );

  };



  const commitNouns = async (newList) => {

    setVocabList(newList);

    await writeToVaultDB(STORE_NAME, BACKUP_KEY, newList);

  };



  const commitVerbs = async (newList) => {

    setVerbsList(newList);

    await writeToVaultDB(VERBS_STORE_NAME, VERBS_BACKUP_KEY, newList);

  };



  const commitPatterns = async (newList) => {

    setPatternsList(newList);

    await writeToVaultDB(PATTERNS_STORE_NAME, PATTERNS_BACKUP_KEY, newList);

  };



  const commitPreps = async (newList) => {

    setPrepsList(newList);

    await writeToVaultDB(PREPOSITIONS_STORE_NAME, PREPOSITIONS_BACKUP_KEY, newList);

  };



  const commitTimes = async (newList) => {

    setTimeList(newList);

    await writeToVaultDB(TIME_STORE_NAME, TIME_BACKUP_KEY, newList);

  };



  if (!isReady) {

    return (

      <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>

        Loading Deutschly...

      </div>

    );

  }



  const allCategoryItems = [

    { id: "Nouns", icon: "📑", label: "Nouns", count: vocabList.length },

    { id: "Patterns", icon: "📐", label: "Patterns", count: patternsList.length },

    { id: "Verbs", icon: "⚡", label: "Verbs", count: verbsList.length },

    { id: "Prepositions", icon: "🎯", label: "Prepositions", count: prepsList.length },

    { id: "Time", icon: "⏰", label: "Time", count: timeList.length },

    { id: "Grammar", icon: "📚", label: "Grammar", count: GRAMMAR_TOPICS.length },

  ];



  return (

    <div className="page-shell" data-theme={theme}>



<Header

  onOpenSidebar={() => setSidebarOpen(true)}

  streakData={streakData}

  onOpenMilestone={() => setMilestoneStreak(streakData.streak || 1)}

/>



      <Sidebar

        isOpen={sidebarOpen}

        onClose={() => setSidebarOpen(false)}

        categories={allCategoryItems}

        activeCategory={mainCategory}

        onSelectCategory={(cat) => {

          setMainCategory(cat);

          setSidebarOpen(false);

        }}

        languageMode={languageMode}

        onToggleLanguage={(newMode) => {

          setLanguageMode(newMode);

          setMainCategory("Nouns");

        }}

        onOpenGoals={() => setGoalModalOpen(true)}

        onOpenReport={() => setReportOpen(true)}

        vocabList={vocabList}
        verbsList={verbsList}
        patternsList={patternsList}
        prepsList={prepsList}
        timeList={timeList}

        onCommitNouns={commitNouns}
        onCommitVerbs={commitVerbs}
        onCommitPatterns={commitPatterns}
        onCommitPreps={commitPreps}
        onCommitTimes={commitTimes}

      />



      <GoalModal

        isOpen={goalModalOpen}

        onClose={() => setGoalModalOpen(false)}

        defaultCategory={mainCategory}

        categoryStats={categoryStats}

      />



      <ReportModal

        isOpen={reportOpen}

        onClose={() => setReportOpen(false)}

        lists={{

          Nouns: vocabList,

          Verbs: verbsList,

          Patterns: patternsList,

          Prepositions: prepsList,

          Time: timeList,

        }}

      />



      {/* 5-day Streak Milestone Popup */}

      <StreakMilestoneModal

        isOpen={Boolean(milestoneStreak)}

        streak={milestoneStreak}

        onClose={() => setMilestoneStreak(null)}

      />



      <main className="page">

        <div className="container">

          {notifPermission === "default" && (

            <button onClick={handleEnableNotifications}>

              🔔 Enable hourly word notifications

            </button>

          )}



          <SubTabs

            currentView={subViews[mainCategory]}

            onChangeView={(view) =>

              setSubViews((prev) => ({ ...prev, [mainCategory]: view }))

            }

          />



          {mainCategory === "Nouns" && (

            <NounsPage

              viewMode={subViews.Nouns}

              vocabList={vocabList}

              onCommitNouns={commitNouns}

              onRequestConfirm={requestConfirmation}

            />

          )}



          {mainCategory === "Patterns" && (

            <PatternsPage

              viewMode={subViews.Patterns}

              patternsList={patternsList}

              onCommitPatterns={commitPatterns}

              onRequestConfirm={requestConfirmation}

            />

          )}



          {mainCategory === "Verbs" && (

            <VerbsPage

              viewMode={subViews.Verbs}

              verbsList={verbsList}

              onCommitVerbs={commitVerbs}

              onRequestConfirm={requestConfirmation}

            />

          )}



          {mainCategory === "Prepositions" && (

            <PrepositionsPage

              viewMode={subViews.Prepositions}

              prepsList={prepsList}

              onCommitPreps={commitPreps}

              onRequestConfirm={requestConfirmation}

            />

          )}



          {mainCategory === "Time" && (

            <TimePage

              viewMode={subViews.Time}

              timeList={timeList}

              onCommitTimes={commitTimes}

              onRequestConfirm={requestConfirmation}

            />

          )}



          {mainCategory === "Grammar" && (

            <GrammarPage viewMode={subViews.Grammar} />

          )}

        </div>

      </main>



      <ConfirmModal

        isOpen={confirmModal.isOpen}

        title={confirmModal.title}

        message={confirmModal.message}

        onConfirm={confirmModal.onConfirm}

        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}

      />

    </div>

  );

}