---
title: An Introduction to World Models
description: A first-principles overview of what world models are and why they matter.
pubDate: 2026-06-26
subject: World Models
chapter: 1
tags:
  - world models
  - model-based rl
  - latent dynamics
draft: false
---

## Motivation behind studying about World Models

Ok why world models in the first place? Basically there are 3 main problems that actually motivate us to study about World Models :

* sample efficiency problem
* partial observability problem
* transfer problem


### Sample Efficieny Problem

Model free RL algorithms learn about policies or value functions directly from environment interactions. Algorithms like DQN, PPO etc fall in this category. Give them enough data and they can acheive super-intelligence. Fundamental reason of inefficiency that is shown by these models is due to this very fact - they learn from raw experience alone. Everything needs to be implictly encoded within the parameters of these models - physics of how things move, how they collide, how gravity will operate - all this has to be encoded in the parameters. Agent cannot generalise physics and then use and reuse it depending upon the environment it is put into. World models on the other hand give this understanding to the agent about how the physics behave so that it able to generate unlimited simulated experience from the limited read data it is trained on. 


### Partial Observability Problem

Agents do not observe the environment fully. Imagine a robot navigating, it only sees what its sensors capture. This is the parial observability problem. Model free RL solve this problem by using recurrent architectures like LSTMs or Transformers - they encode the histroy of what has happened into a "hidden state". Problem with this approach is that "agent has to learn what to remember and how to act simultaneously". Recurrent networks must implicitly find the physical laws , use them for decision making and all this through a single learning signal or reward. WMs on the other hand decouple this problem as they learn the model itself learns the physics of persistence and motion while controller uses representations to select and take actions.

**Partially Observable Markov Decision Process**

In a POMDP ,agent maintains a belief state 

$$
b_t(s) = P(S_t = s \mid o_{1:t},\, a_{1:t-1})
$$

it is the probability distribution of the true state given the history of observations and actions.

### Transfer Problem

Let us say a robot is trying to learn how to navigate in an office building. The physical dynamics of the robot - like interaction with floor, interaction with wall, how doors open etc - all of them remain constant regardless of whether the goal of robot changes or not. In a model-free RL, changing the reward function requires retraining of the policy from scratch because it has both dynamics and reward preference in a single function. World models decouple this as well as the model itself learns the physics of the environment and is reused depending upon the task and just the controller needs to adapt when the task changes. 

## World Model Hypothesis

All above 3 problems converge to one single hypothesis:

> intelligent agents need internal models for their environments

## Core Architecture Pattern

Every functional World Model has these 3 basic components:

1. Encoder / Perception (V): Maps high dimensional observations to comapct latent representations. Role is to discard task-irrelevant information and preserve only what is relevant to the task.
2. Dyanmics / Prediction (M) : It predicts the future latent states given the current states and actions. The model might be recurrent, auto-regressive or  a state space model. 
3. Controller / Planner (C) : Selects actions that the agent is supposed to take based on the current latent state. One thing to note is that,controller never sees the real environment. It entirely works in the latent space.

--insert diagram-----


## Misconceptions

### 1. World models are just sequence models

Not true. Sequence models predict future tokens given past tokens. A world model does the same but it also takes into account the action. A sequence model predicts what will happens, a world model on the other side predicts what will happen if this action is taken into account.

### 2. WMs are only for games:

Nope they are not. Tesla uses it for their self driving car stack, GraphCast by DeepMind uses it for predicting weather and DayDreamer also uses it for training robots.

### 3. Bigger the model ;better the performance

Again not true.

> The quality of a world model depends critically on the alignment between the model’s inductive biases and the environment’s structure.