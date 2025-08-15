
import React, { useEffect, useMemo, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView, View, Text, Pressable, TextInput, FlatList, Alert, StyleSheet, Platform, Modal, ScrollView } from "react-native";
import questionsSeed from "./data/questions.json";

const STORAGE_KEY = "QUIZ_JEU_TV_PRO_MAX_STATE";

export default function App() {
  const [phase, setPhase] = useState("setup"); // setup | game | results
  const [levels, setLevels] = useState(Object.keys(questionsSeed));
  const [level, setLevel] = useState("CP");
  const [players, setPlayers] = useState([{ name: "Équipe A", score: 0 }, { name: "Équipe B", score: 0 }]);
  const [questionsMap, setQuestionsMap] = useState(questionsSeed);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [duration, setDuration] = useState(30);
  const [remaining, setRemaining] = useState(30);
  const intervalRef = useRef(null);
  const [publicMode, setPublicMode] = useState(false); // masque la réponse
  const [mode, setMode] = useState("mix"); // classique | vf | qcm | mix

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setLevel(parsed.level ?? "CP");
          setPlayers(parsed.players ?? players);
          setQuestionsMap(parsed.questionsMap ?? questionsSeed);
          setLevels(Object.keys(parsed.questionsMap ?? questionsSeed));
        }
      } catch(e) {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ level, players, questionsMap }));
  }, [level, players, questionsMap]);

  const allQuestions = useMemo(() => {
    let list = (questionsMap[level] ?? []).filter(q => {
      if (mode === "classique" || mode === "mix") return true;
      if (mode === "vf") return q.type === "vf";
      if (mode === "qcm") return q.type === "qcm";
      return true;
    });
    if (mode === "mix") list = shuffle(list);
    return list;
  }, [questionsMap, level, mode]);

  useEffect(() => {
    if (phase === "game" && timerEnabled) {
      setRemaining(duration);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setRemaining((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      return () => intervalRef.current && clearInterval(intervalRef.current);
    }
  }, [phase, currentIndex, duration, timerEnabled]);

  const startGame = () => {
    if (!players.length || players.some(p => !p.name.trim())) {
      Alert.alert("Oups !", "Ajoute au moins un candidat et un nom.");
      return;
    }
    setPhase("game");
    setCurrentIndex(0);
    setRevealAnswer(false);
  };

  const nextQuestion = () => {
    setRevealAnswer(false);
    if (currentIndex + 1 < allQuestions.length) setCurrentIndex(currentIndex + 1);
    else setPhase("results");
  };

  const givePoint = (idx, delta = 1) => {
    const copy = [...players];
    copy[idx].score += delta;
    if (copy[idx].score < 0) copy[idx].score = 0;
    setPlayers(copy);
  };

  const resetGame = () => {
    setPlayers(players.map(p => ({ ...p, score: 0 })));
    setCurrentIndex(0);
    setPhase("setup");
    setRevealAnswer(false);
  };

  const importFromClipboard = async () => {
    try {
      const txt = await Clipboard.getStringAsync();
      let obj;
      if (txt.trim().startsWith("{")) obj = JSON.parse(txt);
      else obj = parseCSV(txt);
      const merged = mergeQuestions(questionsMap, obj);
      setQuestionsMap(merged);
      setLevels(Object.keys(merged));
      Alert.alert("Import réussi", "Questions ajoutées !");
    } catch(e) {
      Alert.alert("Erreur d'import", e.message || "Format invalide.");
    }
  };

  const exportJSON = async () => {
    const payload = JSON.stringify(questionsMap, null, 2);
    await Clipboard.setStringAsync(payload);
    Alert.alert("Export copié", "Le JSON des questions est copié dans le presse-papiers.");
  };

  const current = allQuestions[currentIndex];
  const total = allQuestions.length;

  if (phase === "setup") {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.title}>Quiz — Pro Max</Text>

        <ScrollView style={{flex:1}} contentContainerStyle={{ paddingBottom: 24 }}>
          <Text style={styles.sectionLabel}>Mode & Niveau</Text>
          <View style={styles.levelRow}>
            {["classique","vf","qcm","mix"].map(m => (
              <Pressable key={m} onPress={() => setMode(m)} style={[styles.chip, mode===m && styles.chipActive]}>
                <Text style={[styles.chipText, mode===m && styles.chipTextActive]}>{m.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.levelRow}>
            {levels.map(l => (
              <Pressable key={l} onPress={() => setLevel(l)} style={[styles.chip, level === l && styles.chipActive]}>
                <Text style={[styles.chipText, level === l && styles.chipTextActive]}>{l}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Candidats / Équipes</Text>
          <FlatList
            scrollEnabled={false}
            data={players}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item, index }) => (
              <View style={styles.playerRow}>
                <Text style={styles.playerIndex}>{index + 1}.</Text>
                <TextInput
                  style={styles.input}
                  value={item.name}
                  onChangeText={(t) => {
                    const copy = [...players];
                    copy[index].name = t;
                    setPlayers(copy);
                  }}
                  placeholder="Nom du candidat / équipe"
                />
                <Pressable style={styles.delete} onPress={() => setPlayers(players.filter((_, i) => i !== index))}>
                  <Text style={styles.deleteText}>×</Text>
                </Pressable>
              </View>
            )}
            ListFooterComponent={
              <Pressable style={styles.addBtn} onPress={() => setPlayers([...players, { name: "", score: 0 }])}>
                <Text style={styles.addBtnText}>+ Ajouter</Text>
              </Pressable>
            }
          />

          <Text style={styles.sectionLabel}>Paramètres</Text>
          <View style={styles.timerRow}>
            <Pressable onPress={() => setPublicMode(!publicMode)} style={[styles.toggle, publicMode && styles.toggleOn]}>
              <Text style={styles.toggleText}>{publicMode ? "Écran public" : "Mode animateur"}</Text>
            </Pressable>
            <Pressable onPress={() => setTimerEnabled(!timerEnabled)} style={[styles.toggle, timerEnabled && styles.toggleOn]}>
              <Text style={styles.toggleText}>Chrono {timerEnabled ? "On" : "Off"}</Text>
            </Pressable>
            <TextInput
              style={styles.inputSmall}
              keyboardType="number-pad"
              value={String(duration)}
              onChangeText={(t) => setDuration(Number(t || 0))}
              placeholder="sec"
            />
            <Text style={styles.hint}>par question</Text>
          </View>

          <View style={styles.manageRow}>
            <Pressable style={styles.secondaryBtn} onPress={importFromClipboard}>
              <Text style={styles.secondaryBtnText}>Importer (presse‑papiers)</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={exportJSON}>
              <Text style={styles.secondaryBtnText}>Exporter JSON</Text>
            </Pressable>
          </View>

          <Pressable style={styles.primaryBtn} onPress={startGame}>
            <Text style={styles.primaryBtnText}>Démarrer la partie</Text>
          </Pressable>
        </ScrollView>

        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  if (phase === "game") {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.badge}>{level}</Text>
          <Text style={styles.progress}>Question {currentIndex + 1}/{total}</Text>
          {timerEnabled && (
            <Text style={[styles.timer, remaining === 0 && { color: "#b00020" }]}>
              {remaining}s
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.theme}>{current?.theme}</Text>
          <Text style={styles.question}>{current?.q}</Text>

          {current?.type === "qcm" && Array.isArray(current?.choices) && (
            <View style={{ marginTop: 8 }}>
              {current.choices.map((c, i) => (
                <Text key={i} style={styles.choice}>• {c}</Text>
              ))}
            </View>
          )}

          {!publicMode && (
            <Pressable onPress={() => setRevealAnswer(!revealAnswer)} style={styles.revealBtn}>
              <Text style={styles.revealBtnText}>{revealAnswer ? "Masquer la réponse" : "Afficher la réponse"}</Text>
            </Pressable>
          )}

          {(revealAnswer || publicMode===false) && !publicMode && (
            <AnswerBlock q={current} />
          )}
        </View>

        <Text style={styles.sectionLabel}>Attribuer le point</Text>
        <View style={styles.playersGrid}>
          {players.map((p, i) => (
            <View key={i} style={styles.playerCardWrap}>
              <Pressable style={styles.playerCard} onPress={() => givePoint(i, +1)} onLongPress={() => givePoint(i, -1)}>
                <Text style={styles.playerName}>{p.name || `Candidat ${i+1}`}</Text>
                <Text style={styles.playerScore}>{p.score} pt{p.score>1?"s":""}</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.bottomRow}>
          <Pressable style={styles.secondaryBtn} onPress={() => setRevealAnswer(true)}>
            <Text style={styles.secondaryBtnText}>Valider mauvaise</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={nextQuestion}>
            <Text style={styles.primaryBtnText}>Question suivante</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // results
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Résultats</Text>
      {players
        .slice()
        .sort((a, b) => b.score - a.score)
        .map((p, i) => (
          <View key={i} style={styles.resultRow}>
            <Text style={styles.resultName}>{p.name || `Candidat ${i+1}`}</Text>
            <Text style={styles.resultScore}>{p.score} pt{p.score>1?"s":""}</Text>
          </View>
        ))}
      <View style={{ height: 12 }} />
      <Pressable style={styles.primaryBtn} onPress={resetGame}>
        <Text style={styles.primaryBtnText}>Rejouer</Text>
      </Pressable>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

function AnswerBlock({ q }) {
  if (!q) return null;
  if (q.type === "vf") {
    return <Text style={styles.answer}>Réponse : <Text style={styles.answerValue}>{q.a ? "Vrai" : "Faux"}</Text></Text>;
  }
  if (q.type === "qcm") {
    return (
      <Text style={styles.answer}>
        Réponse : <Text style={styles.answerValue}>{q.choices?.[q.a]}</Text>
      </Text>
    );
  }
  return <Text style={styles.answer}>Réponse : <Text style={styles.answerValue}>{q.a}</Text></Text>;
}

function mergeQuestions(base, extra) {
  const out = { ...base };
  Object.keys(extra).forEach(k => {
    out[k] = [...(out[k] || []), ...extra[k]];
  });
  return out;
}

function parseCSV(csv) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const out = {};
  for (let i=1;i<lines.length;i++){
    const row = splitCSV(lines[i]);
    const [lev, typ, theme, q, choices, a] = row;
    if (!lev || !q) continue;
    out[lev] = out[lev] || [];
    if (typ === "qcm") {
      const ch = choices ? choices.split("|") : [];
      out[lev].push({ type:"qcm", theme, q, choices: ch, a: Number(a ?? 0) });
    } else if (typ === "vf") {
      const bool = (a ?? "").toString().trim().toLowerCase();
      out[lev].push({ type:"vf", theme, q, a: bool === "true" || bool === "vrai" || bool === "1" });
    } else {
      out[lev].push({ type:"libre", theme, q, a: a ?? "" });
    }
  }
  return out;
}

function splitCSV(line) {
  const arr = [];
  let cur = "", inQ = false;
  for (let i=0;i<line.length;i++){
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { arr.push(cur); cur=""; }
    else cur += c;
  }
  arr.push(cur);
  return arr.map(s => s.replace(/^"(.*)"$/, "$1"));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingTop: Platform.OS === "android" ? 36 : 0, backgroundColor: "#0f172a" },
  title: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 16, textAlign: "center" },
  sectionLabel: { color: "#cbd5e1", marginTop: 12, marginBottom: 6, fontWeight: "600" },
  levelRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "#1f2937", marginRight: 8, marginBottom: 8 },
  chipActive: { backgroundColor: "#2563eb" },
  chipText: { color: "#e5e7eb" },
  chipTextActive: { color: "white", fontWeight: "700" },

  playerRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#111827", padding: 8, borderRadius: 12, marginBottom: 8 },
  playerIndex: { color: "#9ca3af", width: 20, textAlign: "center" },
  input: { flex: 1, backgroundColor: "#0b1220", color: "white", padding: 10, borderRadius: 10, marginHorizontal: 8, borderWidth: 1, borderColor: "#1f2937" },
  delete: { width: 28, height: 28, backgroundColor: "#ef4444", borderRadius: 14, alignItems: "center", justifyContent: "center" },
  deleteText: { color: "white", fontSize: 18, lineHeight: 18 },

  addBtn: { marginTop: 6, padding: 12, borderRadius: 12, backgroundColor: "#1f2937", alignItems: "center" },
  addBtnText: { color: "#e5e7eb", fontWeight: "600" },

  timerRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  manageRow: { flexDirection: "row", gap: 10, marginTop: 12, alignItems: "stretch" },

  toggle: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#1f2937" },
  toggleOn: { backgroundColor: "#22c55e" },
  toggleText: { color: "white", fontWeight: "700" },
  inputSmall: { width: 80, backgroundColor: "#0b1220", color: "white", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#1f2937", textAlign: "center" },
  hint: { color: "#9ca3af" },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  badge: { backgroundColor: "#2563eb", color: "white", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: "700" },
  progress: { color: "#cbd5e1", fontWeight: "600" },
  timer: { color: "white", fontWeight: "700" },

  card: { backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#1f2937" },
  theme: { color: "#93c5fd", marginBottom: 6, fontWeight: "700" },
  question: { color: "white", fontSize: 20, marginBottom: 10, fontWeight: "700" },
  choice: { color: "#e5e7eb", marginTop: 4 },

  revealBtn: { backgroundColor: "#334155", paddingVertical: 10, borderRadius: 10, alignItems: "center", marginTop: 6 },
  revealBtnText: { color: "#e5e7eb", fontWeight: "700" },
  answer: { color: "#cbd5e1", marginTop: 8, fontSize: 16 },
  answerValue: { color: "white", fontWeight: "800" },

  playersGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  playerCardWrap: { width: "48%" },
  playerCard: { backgroundColor: "#0b1220", borderWidth: 1, borderColor: "#1f2937", padding: 12, borderRadius: 14, alignItems: "center" },
  playerName: { color: "#e5e7eb", fontWeight: "700", textAlign: "center" },
  playerScore: { color: "#93c5fd", marginTop: 6, fontWeight: "800" },

  bottomRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  primaryBtn: { flex: 1, backgroundColor: "#22c55e", padding: 14, borderRadius: 12, alignItems: "center" },
  primaryBtnText: { color: "black", fontWeight: "800" },
  secondaryBtn: { flex: 1, backgroundColor: "#f59e0b", padding: 14, borderRadius: 12, alignItems: "center" },
  secondaryBtnText: { color: "black", fontWeight: "800" },

  resultRow: { flexDirection: "row", justifyContent: "space-between", padding: 12, backgroundColor: "#111827", borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: "#1f2937" },
  resultName: { color: "#e5e7eb", fontWeight: "700" },
  resultScore: { color: "white", fontWeight: "800" },
});
