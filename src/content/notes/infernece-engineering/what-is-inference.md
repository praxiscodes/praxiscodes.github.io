---
title: What is LLM Inference
description: notes on llm  inference engineering - v rough
pubDate: 2026-06-27
subject: LLM Inference
chapter: 1
draft: false
---

# What is an LLM inference engine?

You give an input to an LLM - "What is the capital of France?" - the LLM thinks for a moments and outputs "Paris". This brief time for which the LLM thought and answered your given question is called "inference". An inference engine is the system that takes a trained AI model and actually uses it.

![inference and training](https://i.postimg.cc/fLRwgnXD/Screenshot-From-2026-06-27-12-44-36.png)

# Why does this problem exist and why is it hard?

A modern LLM (like Llama 3 70B) has 70 billion parameters. Each parameter is a number. When you ask it a question, it needs to use many of those 70 billion numbers to produce each single word of its answer.

Say you have a tiny model with just 4 parameters (weights):
    w = [0.5, -1.2, 0.8, 3.1]

Input: a single number, x = 2.0

The model computes:
    output = 
    
w[0]*x + w[1]*x + w[2]*x + w[3]*x

= 0.5*2 + (-1.2)*2 + 0.8*2 + 3.1*2

= 1.0 + (-2.4) + 1.6 + 6.2

= 6.4

That's 4 multiplications and 3 additions for a 4-parameter model.

Now scale up:

70 billion parameters × 1 multiplication each = 70 billion multiplications PER TOKEN GENERATED

If the model generates 500 tokens (a decent paragraph), that's:  70,000,000,000 × 500 = 35,000,000,000,000 (35 trillion) multiplications

A single A100 GPU can do roughly 312 trillion FLOPs per second in FP16. So naively: 35 trillion / 312 trillion per second ≈ 0.11 seconds


But that's the math. The real bottleneck is often memory, not computation. Here's why: 

Each parameter = 2 bytes (FP16)
70 billion × 2 bytes = 140 GB

A100 GPU has 80 GB of memory.

You can't even fit the model on one GPU.

This is the fundamental problem: inference is memory-bandwidth bound, not compute-bound. The GPU spends most of its time waiting for weights to arrive from memory rather than doing math.

![memory-comptue-bound-problem](https://i.postimg.cc/sfKnrFhm/Screenshot-From-2026-06-27-12-53-10.png)

This single fact — that inference is memory-bandwidth bound — is the reason inference engines exist as a field. Every optimization, every trick, every system you'll learn about is ultimately trying to solve: how do we get the right weights to the GPU core fast enough?

# What does inference engine actually do?

![workflow](https://i.postimg.cc/D0vmv888/Screenshot-From-2026-06-27-13-50-55.png)

Step 1: Input enters : "The capital of France is?"

Step 2: It gets tokenized and fed to the model layers

Step 3: Sample from logits is taken

Step 4: Append "Paris" to the input and repeat from step 2.

The inference engine manages all of this — tokenization, batching multiple users, scheduling GPU work, caching intermediate results, managing memory, and sampling outputs. The inference engine sits between the application and the raw GPU. It's the operating system for model serving — it decides what runs when, how memory is allocated, how multiple users share resources, and how to squeeze maximum performance out of the hardware.

# The two phases of inference : Decode and Prefill

## Phase 1: Prefill

Input : "The capital of Faris is?"
Tokens : [The, capital, of, France, is] (5 tokens)


Token "The"    ──┐
Token "capital"──┤
Token "of"     ──┼──> GPU processes ALL at once ──> produces next token "Paris"
Token "France" ──┤
Token "is"     ──┘


Characteristics:
- Compute-bound (lots of matrix math, parallelizable)
- Each token attends to all previous tokens
- Heavy GPU utilization
- One-time cost per request

## Phase 2: Decode

One token at a time is generated sequentially. 

Already have: "The capital of France is Paris"
Next token: model generates " ," (one token)
Next token: model generates " which" (one token)
Next token: model generates " is" (one token)
...

Each new token requires:
1. Look at ALL previous tokens (including the original prompt)
2. Compute attention over everything
3. Produce ONE new token

Characteristics:
- Memory-bound (reading the same weights for each token, one at a time)
- Terrible GPU utilization (most cores idle)
- Repeated for every token in the output

Why this matters: Almost every optimization in inference engines targets one of these two phases differently. Batch size, KV caching, quantization, continuous batching — they all exist because prefill and decode have fundamentally different bottlenecks.

# Math behind memory wall

![roofline-model](https://i.postimg.cc/XJ7p3rZN/Screenshot-From-2026-06-27-14-04-34.png)

The roofline model says: your actual performance is the MINIMUM of:

* Your compute ceiling (GPU can do X FLOPs/s)
* Your memory ceiling (memory can deliver Y bytes/s)


# Approaches used in production

* Model Parallelism:
Split the model's weight matrices across multiple GPUs.

GPU 0 gets first half of each layer:
  W_0 = W[:, :half]  (columns 0 to 5,503)

GPU 1 gets second half:
  W_1 = W[:, half:]  (columns 5,504 to 11,007)

Each GPU computes half the output, then they communicate
to combine results.

Requires: High-speed interconnect (NVLink: 600-900 GB/s)
Problem:  GPUs must synchronize every layer → communication overhead

Some good questions and their answers:

Q: 100 tokens in, 500 tokens get out. How many forward passes did happen and how many of them were prefill and decode?

Ans : Prefill happens simultaneously so for 100 tokens it will be just 1. For decode it is 1 step at a time so it will 500 steps for 500 tokens. Thus total forward passes = 501


Q. Why prefill happens all at once?

Ans: Self attention computes how much does one token should attend to every other token. 

Attention = softmax(Q @ K^T / √d_k) @ V -nothing but matrix multiplication - something GPUs are very good at doing parallely. When N = 100 , Q @ K^T is a (100,100) matrix multiplication.

Each of the 10,000 entries can be computed INDEPENDENTLY. A GPU with 10,000 cores can compute them all simultaneously.

Prompt:   100 tokens
Output:   500 tokens

Forward passes:
  Prefill:  1  (processes all 100 input tokens in parallel)
  Decode:   500 (processes one new token each time)
  Total:    501 forward passes

But the COST of each type is wildly different:

* Prefill (1 pass):  Heavy. Processes 100 tokens. ~100× the FLOPs of a single decode step. But GPU is ~90% utilized. Time: significant but one-time.

* Decode (500 passes): Light per step. Only 1 new token each. But GPU is ~2% utilized (waiting on memory). Each step is fast but they add up. This is where latency accumulates.

* Total latency ≈ prefill_time + 500 × decode_step_time

If prefill takes 50ms and each decode step takes 10ms:

> Total = 50 + 500 × 10 = 5,050 ms ≈ 5 seconds => decode dominates

A very subtle point to note is that during prefill, the model processes all 100 tokens and produces logits for only the LAST token (to predict the first generated token). The intermediate tokens' outputs are thrown away. Why? Because during training, the model learned to predict the NEXT token for every position. During inference, we already KNOW all the input tokens. We only need to predict what comes AFTER the last one. So prefill computes attention for all 100 positions (needed because token 99's attention depends on tokens 0-98), but only extracts the output of position 99.


Will keep on adding more!