"""Lightweight, dependency-free review analysis (lexicon-based sentiment + keywords)."""

import re
from collections import Counter

POSITIVE = {
    'amazing', 'awesome', 'beautiful', 'best', 'brilliant', 'captivating', 'classic', 'clever',
    'compelling', 'cool', 'enjoyable', 'enjoyed', 'epic', 'excellent', 'fantastic', 'favorite',
    'fun', 'good', 'gorgeous', 'great', 'incredible', 'love', 'loved', 'masterpiece', 'memorable',
    'outstanding', 'perfect', 'phenomenal', 'polished', 'recommend', 'satisfying', 'smooth',
    'solid', 'stunning', 'superb', 'thrilling', 'touching', 'underrated', 'wonderful', 'worth',
}
NEGATIVE = {
    'awful', 'bad', 'bland', 'boring', 'broken', 'buggy', 'clunky', 'confusing', 'disappointing',
    'disappointed', 'dull', 'forgettable', 'frustrating', 'hate', 'hated', 'horrible', 'lackluster',
    'lazy', 'mediocre', 'messy', 'overrated', 'pointless', 'poor', 'predictable', 'repetitive',
    'ridiculous', 'rushed', 'slow', 'terrible', 'tedious', 'unplayable', 'waste', 'weak', 'worst',
}
NEGATORS = {'not', 'never', 'no', "isn't", "wasn't", "don't", "didn't", 'barely', 'hardly'}
STOPWORDS = {
    'this', 'that', 'with', 'have', 'from', 'they', 'were', 'been', 'their', 'there', 'about',
    'which', 'would', 'could', 'really', 'very', 'just', 'than', 'then', 'some', 'what', 'when',
    'will', 'your', 'also', 'into', 'more', 'much', 'only', 'other', 'even', 'because', 'game',
    'movie', 'film', 'games', 'movies', 'story', 'time', 'like', 'make', 'made', 'does', 'doesn',
}


def tokenize(text):
    return re.findall(r"[a-z']+", text.lower())


def sentiment_score(text):
    """Return a score in [-1, 1]; None for empty text."""
    words = tokenize(text or '')
    if not words:
        return None
    total = 0
    for i, w in enumerate(words):
        val = 1 if w in POSITIVE else -1 if w in NEGATIVE else 0
        if val and i > 0 and words[i - 1] in NEGATORS:
            val = -val
        total += val
    hits = sum(1 for w in words if w in POSITIVE or w in NEGATIVE)
    if hits == 0:
        return 0.0
    return round(max(-1.0, min(1.0, total / hits)), 3)


def label(score):
    if score is None:
        return 'neutral'
    return 'positive' if score > 0.15 else 'negative' if score < -0.15 else 'neutral'


def keywords(texts, limit=8):
    counts = Counter(
        w for t in texts for w in tokenize(t) if len(w) > 3 and w not in STOPWORDS
    )
    return [w for w, _ in counts.most_common(limit)]


def analyze(reviews):
    """reviews: iterable of Review. Returns a summary dict."""
    reviews = list(reviews)
    bodies = [r.body for r in reviews if r.body]
    labels = Counter(label(r.sentiment) for r in reviews if r.sentiment is not None)
    scored = [r.sentiment for r in reviews if r.sentiment is not None]
    n = sum(labels.values())
    avg = round(sum(scored) / len(scored), 3) if scored else None
    if n == 0:
        summary = 'Not enough written reviews yet.'
    else:
        pct = round(100 * labels['positive'] / n)
        mood = 'mostly positive' if pct >= 65 else 'mostly negative' if labels['negative'] / n >= 0.5 else 'mixed'
        summary = f'Reviewers are {mood} ({pct}% positive across {n} written reviews).'
    return {
        'summary': summary,
        'average_sentiment': avg,
        'positive': labels['positive'],
        'neutral': labels['neutral'],
        'negative': labels['negative'],
        'keywords': keywords(bodies),
    }
