// frontend/src/components/Practice/Practice.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faCircle,
  faChevronLeft,
  faChevronRight,
  faBookOpen,
} from "@fortawesome/free-solid-svg-icons";
import { fetchPracticeProblems, fetchUserProfile, toApiUrl } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext.jsx";
import ProblemReadPanel from "./ProblemReadPanel.jsx";
import "./Practice.css";

const DIFFICULTY_OPTIONS = ["all", "easy", "medium", "hard"];
const PAGE_SIZE = 20;

const TAG_MAP = {
  all: "All Types",
  dp: "Dynamic Programming",
  "dynamic programming": "Dynamic Programming",
  dsu: "DSU (Disjoint Set)",
  "disjoint set": "DSU (Disjoint Set)",
  "binary search": "Binary Search",
  "arrays & hashing": "Arrays & Hashing",
  "arrays and hashing": "Arrays & Hashing",
  "brute force": "Brute Force",
  "constructive algorithms": "Constructive Algorithms",
  "data structures": "Data Structures",
  "dfs and similar": "DFS & Traversal",
  "divide and conquer": "Divide & Conquer",
  "graph matchings": "Graph Matchings",
  graphs: "Graphs",
  greedy: "Greedy",
  math: "Math",
  probabilities: "Probabilities",
  sortings: "Sorting",
  sorting: "Sorting",
  strings: "Strings",
  trees: "Trees",
  "two pointers": "Two Pointers",
  "sliding window": "Sliding Window",
  bitmasks: "Bit Manipulation",
  "bit manipulation": "Bit Manipulation",
  games: "Game Theory",
  geometry: "Geometry",
  flows: "Network Flows",
  implementation: "Implementation",
  "number theory": "Number Theory",
  combinatorics: "Combinatorics",
};

function getFormattedTagName(rawTag) {
  if (!rawTag || rawTag === "all") return "All Types";
  const key = String(rawTag).trim().toLowerCase();
  if (TAG_MAP[key]) return TAG_MAP[key];

  return String(rawTag)
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const getDeterministicAcceptanceRate = (problemId = "") => {
  const source = String(problemId);
  let hash = 0;

  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }

  const rate = 35 + (hash % 56);
  return `${rate.toFixed(1)}%`;
};

export default function Practice() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [difficulty, setDifficulty] = useState("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [availableTags, setAvailableTags] = useState(["all"]);
  const [problems, setProblems] = useState([]);
  const [readingProblemId, setReadingProblemId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProblems, setTotalProblems] = useState(0);
  const [solvedProblemIds, setSolvedProblemIds] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState("");

  const solvedProblemSet = useMemo(
    () => new Set((solvedProblemIds || []).map((id) => String(id))),
    [solvedProblemIds]
  );

  useEffect(() => {
    let active = true;

    const loadProfileProgress = async () => {
      if (!user?.uid) {
        setSolvedProblemIds([]);
        return;
      }

      try {
        const profile = await fetchUserProfile(user.uid);
        if (!active) return;

        setSolvedProblemIds(
          Array.isArray(profile?.practiceSolvedProblemIds)
            ? profile.practiceSolvedProblemIds
            : []
        );
      } catch {
        if (!active) return;
        setSolvedProblemIds([]);
      }
    };

    loadProfileProgress();

    return () => {
      active = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    let active = true;

    const loadProblems = async () => {
      try {
        setLoadingList(true);
        setError("");

        const data = await fetchPracticeProblems({
          page: currentPage,
          limit: PAGE_SIZE,
          difficulty: difficulty === "all" ? "" : difficulty,
          tags: selectedTag === "all" ? "" : selectedTag,
        });

        const list = Array.isArray(data?.problems) ? data.problems : [];
        const pages = Math.max(1, Number(data?.pagination?.pages) || 1);
        const total = Math.max(0, Number(data?.pagination?.total) || 0);

        if (!active) return;

        if (currentPage > pages) {
          setCurrentPage(pages);
          return;
        }

        setProblems(list);
        setTotalPages(pages);
        setTotalProblems(total);

        setAvailableTags((prevTags) => {
          const seenLabels = new Set();
          const uniqueList = ["all"];

          const addTag = (raw) => {
            if (!raw || raw === "all") return;
            const formatted = getFormattedTagName(raw);
            const key = formatted.toLowerCase();
            if (!seenLabels.has(key)) {
              seenLabels.add(key);
              uniqueList.push(formatted);
            }
          };

          prevTags.forEach(addTag);
          list.forEach((problem) => {
            if (problem.category) addTag(problem.category);
            (problem.tags || []).forEach(addTag);
          });

          if (selectedTag && selectedTag !== "all") {
            addTag(selectedTag);
          }

          const sortedOthers = uniqueList
            .filter((t) => t !== "all")
            .sort((a, b) => a.localeCompare(b));

          return ["all", ...sortedOthers];
        });
      } catch (err) {
        if (!active) return;

        setError(err.message || "Unable to load practice problems");
        setProblems([]);
        setTotalPages(1);
        setTotalProblems(0);
      } finally {
        if (active) {
          setLoadingList(false);
        }
      }
    };

    loadProblems();

    return () => {
      active = false;
    };
  }, [difficulty, selectedTag, currentPage]);

  const handleDifficultyChange = (event) => {
    setDifficulty(event.target.value);
    setCurrentPage(1);
  };

  const handleTagChange = (event) => {
    setSelectedTag(event.target.value);
    setCurrentPage(1);
  };

  const hasProblems = problems.length > 0;
  const rangeStart = hasProblems ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = hasProblems ? rangeStart + problems.length - 1 : 0;
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;
  const headingLabel =
    totalProblems >= 100
      ? "100+ Problems"
      : totalProblems > 0
        ? `${totalProblems} Problems`
        : "Practice Problems";
  useEffect(() => {
    fetch(toApiUrl("/api/problems/categories"))
      .then((res) => res.json())
      .then((cats) => {
        if (Array.isArray(cats) && cats.length > 0) {
          const seen = new Set();
          const formattedCats = [];
          cats.forEach((c) => {
            const label = getFormattedTagName(c);
            if (!seen.has(label.toLowerCase())) {
              seen.add(label.toLowerCase());
              formattedCats.push(label);
            }
          });
          setAvailableTags(["all", ...formattedCats.sort((a, b) => a.localeCompare(b))]);
        }
      })
      .catch(() => { });
  }, []);

  return (
    <div className="archive-root">
      <div className="archive-header">
        <div className="pre-heading">PROBLEM ARCHIVE</div>
        <h1>{headingLabel}</h1>
        <p>Pick a challenge, test your logic, and track your solved progress. Hone your coding skills in this offline practice workspace before joining the Live Competitive Arena.</p>
      </div>

      <div className="archive-controls archive-panel">
        <div className="archive-filters-wrap">
          <div className="archive-filters">
            <select
              value={difficulty}
              onChange={handleDifficultyChange}
              className="filter-select"
            >
              {DIFFICULTY_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  {level === "all" ? "All Difficulties" : level.charAt(0).toUpperCase() + level.slice(1)}
                </option>
              ))}
            </select>

            <select
              value={selectedTag}
              onChange={handleTagChange}
              className="filter-select"
            >
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag === "all" ? "All Types" : getFormattedTagName(tag)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="archive-meta-pills">
          <span className="archive-pill">{totalProblems} Total</span>
          <span className="archive-pill archive-pill-solved">{solvedProblemSet.size} Solved</span>
        </div>
      </div>

      {error ? <div className="archive-error">{error}</div> : null}

      <div className="archive-panel archive-table-wrap">
        <div className="archive-list-head" aria-hidden="true">
          <div>#</div>
          <div>Status</div>
          <div>Title</div>
          <div>Tags</div>
          <div>Acceptance</div>
          <div>Difficulty</div>
          <div>Action</div>
        </div>

        <div className="archive-list">
          {loadingList ? <div className="loading-state">Loading problems...</div> : null}
          {!loadingList && problems.length === 0 ? (
            <div className="empty-state">No practice problems found.</div>
          ) : null}

          {!loadingList &&
            problems.map((problem, index) => {
              const problemId = problem.id || problem._id;
              const absoluteIndex = (currentPage - 1) * PAGE_SIZE + index + 1;
              const numberStr = `#${String(absoluteIndex).padStart(3, "0")}`;
              const acceptanceRate = getDeterministicAcceptanceRate(problemId);
              const isSolved = solvedProblemSet.has(String(problemId));
              const difficultyLabel = problem.difficulty || "easy";

              return (
                <div
                  key={problemId}
                  className="archive-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/practice/${problemId}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/practice/${problemId}`);
                    }
                  }}
                  aria-label={`Open practice problem ${problem.title}`}
                >
                  <div className="col-num">{numberStr}</div>

                  <div className="col-status">
                    {isSolved ? (
                      <FontAwesomeIcon icon={faCheckCircle} className="status-icon solved" />
                    ) : (
                      <FontAwesomeIcon icon={faCircle} className="status-icon unsolved" />
                    )}
                  </div>

                  <div className="col-title">{problem.title}</div>

                  <div className="col-tags">
                    {(() => {
                      const rawTags = [];
                      if (problem.category) rawTags.push(problem.category);
                      if (Array.isArray(problem.tags)) rawTags.push(...problem.tags);

                      const uniqueTags = [];
                      const seen = new Set();
                      for (const tag of rawTags) {
                        if (typeof tag === "string" && tag.trim()) {
                          const key = tag.trim().toLowerCase();
                          if (!seen.has(key)) {
                            seen.add(key);
                            uniqueTags.push(tag.trim());
                          }
                        }
                      }
                      if (uniqueTags.length === 0) uniqueTags.push("Algorithms");
                      return uniqueTags.slice(0, 2);
                    })().map((tag, tagIndex) => (
                      <span key={`${problemId}-tag-${tagIndex}`} className="tag-pill">
                        {tag.toUpperCase()}
                      </span>
                    ))}
                  </div>

                  <div className="col-acc">{acceptanceRate}</div>

                  <div className={`col-diff diff-${difficultyLabel.toLowerCase()}`}>
                    <span>
                      {difficultyLabel.charAt(0).toUpperCase() + difficultyLabel.slice(1)}
                    </span>
                  </div>

                  <div className="col-action">
                    <button
                      type="button"
                      className="read-problem-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReadingProblemId(problemId);
                      }}
                      aria-label={`Read problem ${problem.title}`}
                      title={`Read ${problem.title}`}
                    >
                      <FontAwesomeIcon icon={faBookOpen} />
                      <span>Read</span>
                    </button>
                  </div>
                </div>
              );
            })}
        </div>

        <div className="archive-pagination">
          <button
            type="button"
            className="archive-nav-btn"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={!canGoPrev || loadingList}
            aria-label="Go to previous page"
          >
            <FontAwesomeIcon icon={faChevronLeft} />
            Previous
          </button>

          <div className="archive-page-display" aria-live="polite">
            <strong>Page {currentPage} of {totalPages}</strong>
            <span>
              {hasProblems
                ? `${rangeStart}-${rangeEnd} of ${totalProblems} problems`
                : `0 of ${totalProblems} problems`}
            </span>
          </div>

          <button
            type="button"
            className="archive-nav-btn"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={!canGoNext || loadingList}
            aria-label="Go to next page"
          >
            Next
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      </div>

      {/* Reusable Notion-Style Read Problem Drawer */}
      <ProblemReadPanel
        problemId={readingProblemId}
        onClose={() => setReadingProblemId(null)}
        initialProblem={problems.find((p) => (p.id || p._id) === readingProblemId)}
      />
    </div>
  );
}