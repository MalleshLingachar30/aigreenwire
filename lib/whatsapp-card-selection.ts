import type { IssueData, Story } from "@/lib/claude";
import { detectTopicLanesForIssue, detectTopicLanesForStory } from "@/lib/issue-freshness";

type StoryCandidate = {
  story: Story;
  originalIndex: number;
  topicLaneIds: Set<string>;
  sourceUrls: Set<string>;
};

function buildCandidates(stories: Story[]): StoryCandidate[] {
  return stories.map((story, index) => ({
    story,
    originalIndex: index,
    topicLaneIds: new Set(detectTopicLanesForStory(story).map((lane) => lane.id)),
    sourceUrls: new Set(story.sources.map((source) => source.url.trim())),
  }));
}

function selectTopStoriesLegacy(data: IssueData): [Story, Story, Story] {
  const indiaStories = data.stories.filter((story) => story.section === "india");
  const forestryStories = data.stories.filter((story) => story.section === "forestry");
  const studentStories = data.stories.filter((story) => story.section === "students");

  const primaryIndia = indiaStories[0];
  const primaryForestry = forestryStories[0];
  const flexStory = indiaStories[1] ?? forestryStories[1] ?? studentStories[0];

  if (!primaryIndia || !primaryForestry || !flexStory) {
    throw new Error("Issue data does not include enough stories for WhatsApp card selection.");
  }

  return [primaryIndia, primaryForestry, flexStory];
}

function countSharedTopicLanes(left: StoryCandidate, right: StoryCandidate): number {
  let count = 0;
  for (const laneId of left.topicLaneIds) {
    if (right.topicLaneIds.has(laneId)) {
      count += 1;
    }
  }
  return count;
}

function sharesSourceUrl(left: StoryCandidate, right: StoryCandidate): boolean {
  for (const sourceUrl of left.sourceUrls) {
    if (right.sourceUrls.has(sourceUrl)) {
      return true;
    }
  }
  return false;
}

function countBlockedLanes(candidate: StoryCandidate, blockedPreviousLaneIds: Set<string>): number {
  let count = 0;
  for (const laneId of candidate.topicLaneIds) {
    if (blockedPreviousLaneIds.has(laneId)) {
      count += 1;
    }
  }
  return count;
}

function countRepeatedLanes(candidate: StoryCandidate, previousSelected: StoryCandidate[]): number {
  return previousSelected.reduce(
    (count, previous) => count + countSharedTopicLanes(candidate, previous),
    0
  );
}

function hasRepeatedSourceUrl(candidate: StoryCandidate, previousSelected: StoryCandidate[]): boolean {
  return previousSelected.some((previous) => sharesSourceUrl(candidate, previous));
}

function scoreCandidate(
  candidate: StoryCandidate,
  previousSelected: StoryCandidate[],
  blockedPreviousLaneIds: Set<string>,
  selectedNow: StoryCandidate[],
  options: {
    preferSectionFreshness: boolean;
    preferStudentsAsFlex: boolean;
  }
): number {
  let score = 100 - candidate.originalIndex * 5;

  for (const laneId of candidate.topicLaneIds) {
    if (blockedPreviousLaneIds.has(laneId)) {
      score -= 180;
    }
  }

  for (const previous of previousSelected) {
    const sharedLanes = countSharedTopicLanes(candidate, previous);
    if (sharedLanes > 0) {
      score -= sharedLanes * 220;
      if (candidate.story.section === previous.story.section) {
        score -= 80;
      }
    }
    if (sharesSourceUrl(candidate, previous)) {
      score -= 500;
    }
  }

  for (const selected of selectedNow) {
    if (candidate.story.section === selected.story.section) {
      score -= 20;
    }
    const sharedLanes = countSharedTopicLanes(candidate, selected);
    if (sharedLanes > 0) {
      score -= sharedLanes * 40;
    }
  }

  if (options.preferSectionFreshness && candidate.story.section === "india") {
    score += 10;
  }

  if (options.preferSectionFreshness && candidate.story.section === "forestry") {
    score += 10;
  }

  if (options.preferStudentsAsFlex && candidate.story.section === "students") {
    score += 35;
  }

  return score;
}

function selectBestCandidate(
  candidates: StoryCandidate[],
  previousSelected: StoryCandidate[],
  blockedPreviousLaneIds: Set<string>,
  selectedNow: StoryCandidate[],
  options: {
    preferSectionFreshness: boolean;
    preferStudentsAsFlex: boolean;
  }
): StoryCandidate | null {
  let best: StoryCandidate | null = null;
  let bestBlockedLaneCount = Number.POSITIVE_INFINITY;
  let bestRepeatedLaneCount = Number.POSITIVE_INFINITY;
  let bestHasRepeatedSource = true;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const blockedLaneCount = countBlockedLanes(candidate, blockedPreviousLaneIds);
    const repeatedLaneCount = countRepeatedLanes(candidate, previousSelected);
    const repeatedSource = hasRepeatedSourceUrl(candidate, previousSelected);
    const score = scoreCandidate(
      candidate,
      previousSelected,
      blockedPreviousLaneIds,
      selectedNow,
      options
    );
    const isBetter =
      blockedLaneCount < bestBlockedLaneCount ||
      (blockedLaneCount === bestBlockedLaneCount &&
        (repeatedLaneCount < bestRepeatedLaneCount ||
          (repeatedLaneCount === bestRepeatedLaneCount &&
            ((!repeatedSource && bestHasRepeatedSource) ||
              (repeatedSource === bestHasRepeatedSource && score > bestScore)))));

    if (isBetter) {
      best = candidate;
      bestBlockedLaneCount = blockedLaneCount;
      bestRepeatedLaneCount = repeatedLaneCount;
      bestHasRepeatedSource = repeatedSource;
      bestScore = score;
    }
  }

  return best;
}

export function selectTopStoriesWithFreshness(
  data: IssueData,
  previousIssue: IssueData | null = null
): [Story, Story, Story] {
  if (!previousIssue) {
    return selectTopStoriesLegacy(data);
  }

  const previousSelected = buildCandidates(selectTopStoriesLegacy(previousIssue));
  const blockedPreviousLaneIds = new Set(
    detectTopicLanesForIssue(previousIssue).map((lane) => lane.id)
  );
  const indiaCandidates = buildCandidates(
    data.stories.filter((story) => story.section === "india")
  );
  const forestryCandidates = buildCandidates(
    data.stories.filter((story) => story.section === "forestry")
  );
  const studentCandidates = buildCandidates(
    data.stories.filter((story) => story.section === "students")
  );

  const selected: StoryCandidate[] = [];

  const primaryIndia = selectBestCandidate(
    indiaCandidates,
    previousSelected,
    blockedPreviousLaneIds,
    selected,
    {
      preferSectionFreshness: true,
      preferStudentsAsFlex: false,
    }
  );
  if (!primaryIndia) {
    throw new Error("Issue data does not include enough India stories for WhatsApp card selection.");
  }
  selected.push(primaryIndia);

  const remainingAfterIndia = forestryCandidates.filter(
    (candidate) => candidate.story !== primaryIndia.story
  );
  const primaryForestry = selectBestCandidate(
    remainingAfterIndia,
    previousSelected,
    blockedPreviousLaneIds,
    selected,
    {
      preferSectionFreshness: true,
      preferStudentsAsFlex: false,
    }
  );
  if (!primaryForestry) {
    throw new Error("Issue data does not include enough forestry stories for WhatsApp card selection.");
  }
  selected.push(primaryForestry);

  const usedStories = new Set(selected.map((candidate) => candidate.story));
  const flexPool = [...indiaCandidates, ...forestryCandidates, ...studentCandidates].filter(
    (candidate) => !usedStories.has(candidate.story)
  );
  const flexStory = selectBestCandidate(
    flexPool,
    previousSelected,
    blockedPreviousLaneIds,
    selected,
    {
      preferSectionFreshness: false,
      preferStudentsAsFlex: true,
    }
  );

  if (!flexStory) {
    throw new Error("Issue data does not include enough stories for WhatsApp card selection.");
  }

  return [primaryIndia.story, primaryForestry.story, flexStory.story];
}
