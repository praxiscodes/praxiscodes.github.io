---
title: Transformer Attention
description: ntoes on tranformer attention - from scratch
pubDate: 2026-06-27
subject: LLM Inference
chapter: 2
draft: false
---

# The problem

Sentence : " The *bank* of river was muddy - the word bank can mean a financial institution or side of a river. The reason we as humans are able to comprehend it as the side of the river is because of the surrounding words. Attention is just "how much attention should each word pay to every other word."

# Simplest possible attention

## Attempt 1 : Just average out everything

We have 4 words, each represented as a 3-dimensional vector, words = {
    "The":   [1.0, 0.2, 0.1],
    "bank":  [0.3, 1.5, 0.8],
    "of":    [0.1, 0.1, 0.5],
    "river": [0.5, 0.3, 1.2]
}

# Stack into a matrix: shape (4, 3)
X = np.array([words["The"], words["bank"], words["of"], words["river"]])

X =
┌──────────────────┐
│  1.0   0.2   0.1  │  ← "The"
│  0.3   1.5   0.8  │  ← "bank"
│  0.1   0.1   0.5  │  ← "of"
│  0.5   0.3   1.2  │  ← "river"
└──────────────────┘

4 positions × 3 dimensions

Average out all the rows = = [(1.0+0.3+0.1+0.5)/4, (0.2+1.5+0.1+0.3)/4, (0.1+0.8+0.5+1.2)/4]

= [0.475, 0.525, 0.65]

Every position gets the SAME output: [0.475, 0.525, 0.65]

"The"   → [0.475, 0.525, 0.65]  (same)
"bank"  → [0.475, 0.525, 0.65]  (same)
"of"    → [0.475, 0.525, 0.65]  (same)
"river" → [0.475, 0.525, 0.65]  (same)

Problem: "bank" gets the exact same representation as "The." But "bank" should care MORE about "river" than "The" does. Averaging destroys all positional information. Every word becomes the same mush.

## Attempt 2 : Learnable Weights

learning different weights for each position.

                "The"  "bank"  "of"  "river"
For "The":     [0.1,   0.2,   0.3,  0.4  ]   ← cares most about "river"?
For "bank":    [0.1,   0.1,   0.2,  0.6  ]   ← cares most about "river"
For "of":      [0.4,   0.1,   0.1,  0.4  ]   ← cares about "The" and "river"
For "river":   [0.2,   0.5,   0.1,  0.2  ]   ← cares most about "bank"

Problem: These weights are fixed — the same for every input. The word "bank" in "bank of the river" should attend to "river," but the word "bank" in "I went to the bank to deposit money" should attend to "deposit" and "money." Fixed weights can't do this. The attention pattern must depend on the content of the words, not just their positions.


## Attempt 3 : Content-Dependent Weights

Idea: Compute the weight between two positions based on how similar their vectors are. If two words have similar representations, they should attend to each other more. This is the birth of attention. The weights aren't fixed. They're computed from the content itself. Two words that are semantically similar (in vector space) will naturally attend to each other more.

### From Dot Product to Softmax to Attention

Raw dot products aren't good weights because:

1. They can be negative
2. They don't sum to 1 (we need a probability distribution)

This is how attention is derived from nothing.

# Why Q,K & V? Deriving these three matrices

Right now, we're using the raw word vectors to compute similarity AND to produce the output. That's a problem.

Currently, our attention does:

1. Similarity: score(i, j) = x_i · x_j      (dot product of inputs)
2. Output:      y_i = Σ weight_ij × x_j       (weighted sum of inputs)

The SAME vectors X are used for:
  - Deciding WHAT to attend to (the similarity scoring)
  - Deciding WHAT INFORMATION to gather (the output values)

Why is this a problem? Consider these two tasks:

Task 1 (scoring): "Is word A related to word B?" This is about matching — finding which positions are relevant.
Task 2 (output): "What information should I extract from word B?" This is about content — pulling useful features.

A word vector that's good at being "matched against" might not be good at providing "content to extract." These are different functions. Using the same vector for both forces a compromise.

## Solution : Three separate projections

Input X (d dimensions)
    │
    ├──→ multiply by W_Q → Q (Query)    "What am I looking for?"
    ├──→ multiply by W_K → K (Key)      "What do I contain?"
    └──→ multiply by W_V → V (Value)    "What information should I give?"

![calculating-attention](https://i.postimg.cc/0jh4KD51/Screenshot-From-2026-06-29-12-26-28.png)

# Why scale by 1/d_k^0.5?

The Problem : Softmax Saturation

Softmax is an exponential function. If one input is much larger than the others, it "hogs" almost all the probability mass:

softmax([1, 2, 3])       = [0.09, 0.24, 0.67]  ← reasonable spread

softmax([1, 2, 10])      = [0.00, 0.00, 1.00]  ← one wins, rest get nothing

softmax([1, 2, 100])     = [0.00, 0.00, 1.00]  ← even worse

When this happens then it is as same as no attention at all - the graidents become 0 and thus the learning of the model stops entirely.

For a deep analysis read this: 

# Causal Masking : Why do we need to hide the future?

In our computation above, word 0 can attend to word 2. But during inference, we generate words one at a time. When we're generating word 1, word 2 doesn't exist yet. Even during training (where we have the full sequence), we don't want word 0 to cheat by looking at word 2. The model should learn to predict the next word from previous words only.

## Solution : Mask future positions

Before we apply softmax we set all the future scores to "- infinity"m(because when softmax gets applied to - inf the values will turn to 0 thus masking the future tokens).

## Why it matter for KV Cache

During PREFILL (processing prompt):

  - All tokens are processed at once.
  - Causal mask ensures token i doesn't see token j > i.
  - ALL tokens' K and V are computed and cached.

During DECODE (generating new token):

  - The new token (position N) needs to attend to ALL previous tokens.
  - The KV cache has K[0..N-1] and V[0..N-1].
  - The new token computes Q[N], K[N], V[N].
  - K[N] and V[N] are APPENDED to the cache.
  - Attention computes Q[N] against K[0..N] (all cache + new key).

The causal mask is trivially satisfied: the new token IS the last position, so it can see everything. No masking needed for decode of a single new token!

> This is subtle but important: causal masking is a prefill concern. During decode, the single new token naturally can only see the past (that's all that exists).


# Multi-head attention

ex:

> "The cat sat on the mat because it was tired."

What does "it" refer to? It could be "cat" or "mat." But "tired" helps — cats get tired, mats don't. So "it" should attend to "cat" via the semantic relationship. But "it" also has a grammatical relationship — it's a pronoun that refers back to a noun. And a positional relationship — it's close to "cat" in the sentence.

A single attention head has to encode ALL of these in one set of weights. That's asking too much.

## Solution: have multiple attention heads thus havingmultiple perspectives

Each head (H) learns to look for different patterns and thus learns different projections that would be difficult for sinlge head attention.

Head 1 might learn:   "attend to the subject of the sentence"
Head 2 might learn:   "attend to the most recent noun"
Head 3 might learn:   "attend to words with similar meaning"
Head 4 might learn:   "attend to the object of the preposition"

Each head independently:
  1. Computes its own Q_h, K_h, V_h
  2. Computes its own attention weights
  3. Produces its own output

Then all heads' outputs are concatenated and projected back.

## Why it works?

