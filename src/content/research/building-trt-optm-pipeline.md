---
title: building a tensorrt optimization pipeline from pytorch to an optimized inference engine
description: detailed notes on model design, onnx export, tensorrt engine compilation, and runtime benchmark interpretation.
pubDate: 2026-07-01
updatedDate: 2026-07-01
draft: false
tags: [tensorrt, pytorch, onnx, inference, cuda]
featured: true
---

# Building a TensorRT Optimization Pipeline: From PyTorch to an Optimized Inference Engine (Part I)

---

# Goal

The objective of this experiment was to build a minimal yet representative convolutional neural network that could be used to demonstrate TensorRT's graph optimization capabilities.

Rather than optimizing a production-scale model such as ResNet or EfficientNet, the goal was to construct a deliberately simple architecture containing common optimization patterns:

* Conv → BatchNorm → ReLU
* Conv → BatchNorm → ReLU
* Linear → ReLU
* Final Linear layer

These patterns are precisely the kinds of operator sequences that TensorRT attempts to optimize through graph transformations and kernel fusion.

The experiment was designed to answer two questions:

1. How does TensorRT transform an ordinary PyTorch model into an optimized execution graph?
2. What measurable improvements can be observed after optimization?

---

# Background

Modern deep learning frameworks separate a model into several representations before execution.

```
PyTorch Model
      │
      ▼
ONNX Graph
      │
      ▼
TensorRT Optimizer
      │
      ▼
Optimized TensorRT Engine
      │
      ▼
CUDA Runtime
      │
      ▼
GPU
```

Each stage serves a different purpose.

The PyTorch model represents the neural network as Python code executing individual operators.

ONNX converts that Python implementation into a framework-independent computational graph.

TensorRT then analyzes this graph, removes redundant operations, fuses compatible operators together, selects highly optimized CUDA kernels, and generates an executable inference engine.

The experiment intentionally follows this entire pipeline rather than evaluating TensorRT as a black box.

---

# Timeline

## Step 1 — Designing a Minimal Network for Layer Fusion

### Objective

Construct a network containing operator sequences that TensorRT commonly optimizes.

### Initial Hypothesis

TensorRT cannot demonstrate meaningful optimization unless the graph contains patterns suitable for fusion.

Therefore, instead of using isolated convolutional layers, the model should include repeated occurrences of:

```
Conv
 ↓
BatchNorm
 ↓
ReLU
```

along with a fully connected stage.

### Implementation

The model architecture consisted of:

```
Input (32×32×3)
        │
        ▼
Conv2D
        │
BatchNorm
        │
ReLU
        │
MaxPool
        │
        ▼
Conv2D
        │
BatchNorm
        │
ReLU
        │
MaxPool
        │
Flatten
        │
Linear
        │
ReLU
        │
Linear
        │
Output
```

The network was intentionally shallow.

The purpose was not to maximize accuracy but to maximize interpretability.

Every operation could later be traced through ONNX and TensorRT.

---

## Step 2 — Initial Shape Mismatch

### Objective

Run the model successfully before exporting it.

### Initial Implementation

The first fully connected layer was defined as

```
Linear(64 × 8 × 8 → 128)
```

which corresponds to

```
4096 input features
```

### Result

The model failed during the first forward pass.

The important error was

```
RuntimeError:

a and b must have same reduction dim,
but got

[1,256] × [4096,128]
```

---

### Understanding the Error

This error originated from PyTorch's matrix multiplication implementation inside the Linear layer.

A Linear layer performs

```
Y = XWᵀ + b
```

where

```
X : (batch, input_features)

W : (output_features, input_features)
```

The layer expected

```
(1,4096)
```

but received

```
(1,256)
```

Matrix multiplication therefore became

```
(1,256)

×

(4096,128)
```

The inner dimensions (256 and 4096) did not match.

Consequently, matrix multiplication was mathematically impossible.

---

### Root Cause Analysis

The bug was not inside the Linear layer.

The bug originated much earlier in the network.

The spatial dimensions evolved as follows.

Input

```
32 × 32
```

After first pooling

```
32

↓

8
```

After second pooling

```
8

↓

2
```

Therefore,

```
64 feature maps

×

2

×

2

=

256 features
```

Flattening therefore produced

```
(batch,256)
```

not

```
(batch,4096)
```

The mismatch originated from incorrectly assuming that the second pooling layer preserved an 8×8 feature map.

---

### Fix Considered

Two possible solutions existed.

Option 1

Remove the second pooling layer.

This would preserve the 8×8 feature map and justify a 4096-dimensional Linear layer.

Option 2

Accept the 2×2 feature map and modify the Linear layer.

The second option was chosen because it preserved the intended network structure.

The first fully connected layer became

```
Linear(256,128)
```

instead of

```
Linear(4096,128)
```

---

### Why This Fix Worked

After the modification,

the flattened tensor became

```
(batch,256)
```

which exactly matched the expected input dimensionality of the Linear layer.

The forward pass completed successfully.

---

### Lesson Learned

Whenever a Linear layer reports an input mismatch,

the root cause usually lies in the spatial dimensions produced by previous convolutional or pooling layers.

The correct debugging strategy is not to inspect the Linear layer first.

Instead,

trace tensor shapes throughout the network.

---

## Step 3 — Exporting the Model to ONNX

### Objective

Convert the PyTorch computation graph into a framework-independent representation.

### Motivation

TensorRT cannot directly optimize arbitrary PyTorch Python code.

Instead,

it consumes an intermediate computational graph.

ONNX provides precisely that representation.

---

### Implementation

The model was exported using

```
torch.onnx.export()
```

with a dummy input tensor.

The exported graph was then loaded using the ONNX Python API.

The total number of graph nodes was counted.

---

### Unexpected Warning

Although the export succeeded,

the exporter produced several warnings.

The important message stated that

```
Requested opset 11

↓

Exporter internally generated opset 18

↓

Attempted version conversion

↓

Conversion failed

↓

Model kept as opset 18
```

---

### Root Cause

The latest PyTorch ONNX exporter internally targets newer ONNX operator sets.

Although the export request specified opset 11,

the exporter generated an opset 18 graph.

It then attempted to downgrade the graph.

The downgrade failed because certain operators did not possess backward conversion adapters.

This warning originated from the ONNX version converter rather than the exporter itself.

---

### Why This Was Not Actually a Failure

Despite the warning,

the exported ONNX file loaded successfully.

The graph could be parsed.

Its nodes could be counted.

Therefore,

the actual export process succeeded.

Only the optional version-conversion step failed.

---

### Lesson Learned

Warnings produced during model export do not necessarily indicate export failure.

Always verify whether the generated model is actually usable before attempting to fix every warning.

---

## Step 4 — Building a TensorRT Engine

### Objective

Transform the ONNX graph into an optimized inference engine.

### Initial Assumption

Most publicly available TensorRT tutorials target TensorRT 8 or TensorRT 9.

The implementation initially followed those examples.

---

### First Failure

The builder failed with

```
NetworkDefinitionCreationFlag.EXPLICIT_BATCH
```

being unavailable.

---

### Root Cause

TensorRT 11 removed implicit batch mode entirely.

Older TensorRT versions required developers to explicitly request

```
Explicit Batch
```

using

```
EXPLICIT_BATCH
```

TensorRT 11 no longer supports implicit batching.

Every network is explicit by default.

Consequently,

the flag itself disappeared.

---

### Engineering Decision

Instead of attempting to emulate deprecated behavior,

the implementation adopted the TensorRT 11 API.

The network was created directly without requesting an explicit batch mode.

This aligned the implementation with the current TensorRT architecture.

---

## Step 5 — Building the Serialized Engine

### Objective

Convert the parsed ONNX graph into a serialized TensorRT engine.

### Implementation

The workflow consisted of

```
Builder

↓

Network

↓

ONNX Parser

↓

Builder Configuration

↓

Serialized Engine

↓

Engine File
```

A workspace memory limit of 1 GB was assigned through

```
MemoryPoolType.WORKSPACE
```

The resulting serialized engine was written to disk and later deserialized for inspection.

---

### Why Serialization Matters

Unlike ONNX,

which stores only the computational graph,

a TensorRT engine stores

* optimized execution plans
* selected CUDA kernels
* memory allocation strategy
* graph transformations
* scheduling information

The engine therefore represents an executable artifact rather than a portable model description.

This distinction explains why TensorRT engines frequently differ in size from the original ONNX model.

The engine is not merely storing weights—it is storing an optimized execution strategy.

---

### Lessons from Part I

Several recurring engineering principles emerged during the first half of the experiment.

1. Shape mismatches almost always originate upstream of the reported layer.

2. Debugging tensor dimensions is easier when every spatial transformation is traced mathematically.

3. ONNX serves as an intermediate representation rather than an optimized execution format.

4. TensorRT tutorials written for earlier releases cannot be assumed to work on TensorRT 11 because significant API changes have occurred.

5. Engine generation is not simply model serialization—it is a compilation step that embeds optimization decisions into the final executable engine.


# Building a TensorRT Optimization Pipeline: From PyTorch to an Optimized Inference Engine (Part II)

---

# Timeline (Continued)

## Step 6 — Investigating FP16 Engine Generation

### Objective

The initial intention was to compare not only TensorRT's graph optimization but also its memory efficiency.

The hypothesis was straightforward:

```text
FP32 Weights
        ↓
TensorRT FP16 Engine
        ↓
Approximately 50% smaller storage footprint
```

Since half-precision numbers occupy 16 bits instead of 32 bits, it appeared reasonable to expect the TensorRT engine to be significantly smaller.

---

### Initial Observation

After generating the engine, the measured sizes were approximately

```text
PyTorch Weights      ≈ 210 KB
TensorRT Engine      ≈ 271 KB
```

This observation contradicted the original hypothesis.

Instead of becoming smaller, the TensorRT engine was larger.

---

### Initial Hypothesis

The immediate assumption was that TensorRT had generated an FP32 engine instead of an FP16 engine.

The next objective therefore became forcing TensorRT to build an FP16 engine.

---

## Step 7 — Attempting to Enable FP16

### Initial Implementation

Following older TensorRT examples, the first attempt was

```text
Builder
      │
      ▼
BuilderFlag.FP16
      │
      ▼
FP16 Engine
```

using

```python
config.set_flag(trt.BuilderFlag.FP16)
```

---

### Result

TensorRT immediately produced

```text
AttributeError

BuilderFlag has no attribute FP16
```

---

### Subsystem Responsible

This exception originated entirely from the Python TensorRT bindings.

The error occurred before engine construction even began.

---

### Initial Interpretation

At first glance, this looked like an incomplete TensorRT installation.

However,

further inspection revealed something much more interesting.

---

## Step 8 — Investigating TensorRT Version Differences

Instead of assuming documentation correctness,

the actual TensorRT installation was inspected.

Printing

```python
dir(trt.BuilderFlag)
```

revealed

```text
TF32
DEBUG
SPARSE_WEIGHTS
GPU_FALLBACK
...
```

but notably absent were

```text
FP16
INT8
BF16
FP8
```

Similarly,

examining

```python
NetworkDefinitionCreationFlag
```

revealed

```text
STRONGLY_TYPED
```

instead of

```text
EXPLICIT_BATCH
```

---

### Engineering Realization

The implementation was not using the TensorRT API expected by most online tutorials.

Instead,

it was using the TensorRT 11 API,

which adopts a fundamentally different philosophy.

---

## Understanding the Architectural Shift

Older TensorRT versions treated numerical precision as a builder configuration.

Conceptually,

```text
Network

↓

Builder Flag

↓

FP16 Engine
```

TensorRT 11 instead treats precision as a property of the computational graph itself.

The architecture becomes

```text
PyTorch Model
      │
      ▼
ONNX Graph
      │
      ▼
Strongly Typed TensorRT Network
      │
      ▼
Engine
```

Instead of asking the builder

*"please make this FP16"*,

the graph itself specifies

*"this tensor is FP16."*

This seemingly small API change reflects a much larger architectural redesign.

---

### Lesson Learned

Version numbers alone are insufficient.

Major software systems frequently introduce conceptual changes rather than merely renaming functions.

Understanding the design philosophy behind an API often explains many seemingly unrelated breaking changes.

---

## Step 9 — Rethinking Storage Footprint as a Metric

Initially,

storage footprint appeared to be an intuitive optimization metric.

Smaller engine

↓

Better optimization

However,

this assumption proved incorrect.

TensorRT engines contain much more than model parameters.

They also serialize

* execution plans
* optimized kernel selections
* tactic information
* memory planning
* runtime metadata
* scheduling decisions

Conceptually,

```text
PyTorch Model

Weights
Only
```

versus

```text
TensorRT Engine

Weights
+
Kernel Plans
+
Scheduling
+
Memory Planner
+
Execution Metadata
```

The TensorRT engine therefore stores both the model and the compiler's decisions.

Consequently,

comparing engine size with model size became misleading.

---

### Engineering Decision

Storage footprint was removed from the final comparison.

Instead,

the benchmark focused on metrics directly related to optimization quality.

---

## Step 10 — Selecting Better Evaluation Metrics

After reconsidering the objectives,

two metrics emerged as significantly more meaningful.

### Metric 1

Graph Complexity

```text
ONNX Graph Nodes

↓

TensorRT Engine Layers
```

This directly measures how much TensorRT simplified the computational graph.

---

### Metric 2

Inference Latency

```text
PyTorch Eager Execution

↓

TensorRT Engine Execution
```

This measures the practical consequence of graph optimization.

Together,

these metrics evaluate both

* structural optimization
* runtime performance

without relying on misleading indicators such as file size.

---

## Step 11 — Implementing the Benchmark

The benchmark was intentionally divided into two independent sections.

### PyTorch Benchmark

The procedure consisted of

* warmup iterations
* GPU synchronization
* repeated inference
* average latency computation

Warmup removes one-time initialization costs.

GPU synchronization ensures asynchronous CUDA execution does not distort timing.

---

### TensorRT Benchmark

TensorRT required several additional steps.

```text
Serialized Engine

↓

Runtime

↓

Execution Context

↓

Input Tensor

↓

Output Tensor

↓

CUDA Stream

↓

execute_async_v3()
```

Unlike PyTorch,

TensorRT executes directly through the runtime API.

Memory pointers are explicitly registered before execution.

This lower-level execution path eliminates much of the framework overhead present in eager execution.

---

## Step 12 — Measuring Graph Simplification

The ONNX graph contained

```text
10 nodes
```

while the optimized TensorRT engine contained

```text
6 layers
```

The corresponding fusion ratio became

```text
6 / 10 = 0.60
```

or

```text
40% graph reduction
```

---

### Interpretation

This does not necessarily mean

*"four layers disappeared."*

Instead,

TensorRT performed multiple graph transformations such as

```text
Conv

↓

BatchNorm

↓

ReLU
```

becoming

```text
Single Optimized CUDA Kernel
```

Additional graph simplifications,

such as removing unnecessary bookkeeping operations,

also contribute to the reduction.

---

## Step 13 — Measuring Runtime Performance

The measured latencies were

```text
PyTorch

1.2179 ms
```

versus

```text
TensorRT

0.1053 ms
```

producing

```text
11.57×

speedup
```

---

### Why Such a Large Improvement?

Several optimizations occur simultaneously.

The improvement cannot be attributed solely to layer fusion.

Instead,

TensorRT combines multiple optimizations.

```text
ONNX Graph

↓

Constant Folding

↓

Dead Node Elimination

↓

Kernel Fusion

↓

Kernel Auto-Tuning

↓

Memory Planning

↓

Optimized CUDA Scheduling
```

Each optimization individually reduces execution overhead.

Collectively,

they produce substantial improvements even for relatively small networks.

---

### Important Observation

This benchmark compares

```text
PyTorch Eager

versus

TensorRT Engine
```

not

```text
CUDA Kernels

versus

CUDA Kernels
```

Therefore,

part of the measured speedup originates from removing Python framework overhead.

This distinction is important when interpreting benchmark results.

---

# Experimental Results

The final experiment produced

| Metric                 |     Value |
| ---------------------- | --------: |
| ONNX Graph Nodes       |        10 |
| TensorRT Engine Layers |         6 |
| Fusion Ratio           |      0.60 |
| Graph Reduction        |       40% |
| PyTorch Latency        | 1.2179 ms |
| TensorRT Latency       | 0.1053 ms |
| Overall Speedup        |    11.57× |

These numbers demonstrate both structural and runtime optimization.

The graph becomes simpler,

and the execution becomes significantly faster.

---

# Lessons from Part II

Several broader engineering lessons emerged.

First,

optimization should be evaluated using metrics that directly measure computational efficiency.

Graph simplification and runtime latency satisfy this criterion.

Engine size does not.

Second,

major API revisions often reflect deeper architectural changes rather than simple interface modifications.

Understanding the underlying design philosophy reduces debugging effort considerably.

Finally,

TensorRT should not be viewed merely as an inference library.

It is more accurately understood as a compiler.

Like a traditional compiler,

it accepts a high-level program,

applies multiple optimization passes,

selects hardware-specific implementations,

and emits an optimized executable tailored for a particular GPU.


# Building a TensorRT Optimization Pipeline: From PyTorch to an Optimized Inference Engine (Part III)

---

# Technical Deep Dive

## Understanding Layer Fusion from First Principles

The central idea behind TensorRT is not merely to execute neural networks—it is to **reduce unnecessary computation and memory movement**.

A GPU spends much of its execution time waiting for data to move between different levels of memory.

Every independent neural network operator typically performs the following sequence:

```text
Read input from global memory
        │
        ▼
Perform computation
        │
        ▼
Write output back to global memory
```

If the network contains

```text
Conv
 ↓
BatchNorm
 ↓
ReLU
```

then naïve execution performs three independent kernel launches.

```text
Global Memory
      │
      ▼
Conv Kernel
      │
Write Output
      │
      ▼
Global Memory
      │
      ▼
BatchNorm Kernel
      │
Write Output
      │
      ▼
Global Memory
      │
      ▼
ReLU Kernel
      │
Write Output
      │
      ▼
Global Memory
```

Notice what happens.

The intermediate tensor is written back to VRAM twice.

Those writes are expensive.

---

## Why Fusion Helps

TensorRT recognizes that these operations can be mathematically merged.

Instead of

```text
Conv

↓

BatchNorm

↓

ReLU
```

TensorRT produces

```text
Fused CUDA Kernel
```

The execution becomes

```text
Global Memory
      │
      ▼
Single CUDA Kernel

Conv
+
BatchNorm
+
ReLU

      │
      ▼
Global Memory
```

The intermediate tensors never leave the GPU registers or shared memory.

This reduces

* memory bandwidth
* kernel launch overhead
* synchronization

The GPU spends more time computing and less time moving data.

---

## Why Conv and BatchNorm Can Be Fused

Batch Normalization during inference performs

$$
y = \gamma\frac{x-\mu}{\sqrt{\sigma^2+\epsilon}} + \beta
$$

Convolution performs

$$
x = W * u + b
$$

Substituting the convolution into BatchNorm gives

$$
y = \gamma\frac{Wu+b-\mu}{\sqrt{\sigma^2+\epsilon}} + \beta
$$

The constants

* γ
* β
* μ
* σ

are fixed during inference.

Therefore,

TensorRT precomputes new weights

$$
W' = \frac{\gamma}{\sqrt{\sigma^2+\epsilon}}W
$$

and a new bias

$$
b' = \beta + \frac{\gamma(b-\mu)}{\sqrt{\sigma^2+\epsilon}}
$$

The runtime BatchNorm disappears completely.

No numerical approximation is introduced.

The network computes exactly the same function.

---

# ONNX as an Intermediate Representation

PyTorch executes Python code.

TensorRT cannot optimize arbitrary Python programs.

Instead,

PyTorch exports the computation into ONNX.

```text
Python Code

↓

Computational Graph

↓

TensorRT Optimizer
```

Unlike Python,

the ONNX graph explicitly lists

* operators
* tensors
* data flow
* dependencies

This makes compiler-style optimizations possible.

---

# Why TensorRT Builds an Engine

Many beginners think the TensorRT engine is simply another model file.

It is better understood as an executable program.

```text
ONNX

↓

Compiler

↓

TensorRT Engine
```

The engine contains

* optimized kernels
* execution schedule
* memory planner
* tactic selections
* graph transformations

This is why engine size cannot be directly compared with model size.

---

# CUDA Kernel Launches

PyTorch eager execution roughly behaves like

```text
Python

↓

Launch Conv

↓

Launch BatchNorm

↓

Launch ReLU

↓

Launch Pool

↓

Launch Conv

↓

Launch BatchNorm

↓

Launch ReLU

↓

Launch Pool

↓

Launch Linear

↓

Launch ReLU

↓

Launch Linear
```

Each operator generally launches its own CUDA kernel.

TensorRT instead performs

```text
Engine

↓

Optimized Schedule

↓

Launch Fused Kernel

↓

Launch Fused Kernel

↓

Launch Linear

↓

Launch Output
```

Fewer launches mean

* less driver overhead
* fewer synchronizations
* higher GPU utilization

---

# Understanding the Final Metrics

## Metric 1

Graph Complexity

![graph complexity comparison between onnx nodes and tensorrt engine layers](https://i.postimg.cc/tTvVGD6C/Screenshot-From-2026-07-01-15-51-34.png)

```text
ONNX

10 Nodes

↓

TensorRT

6 Layers
```

This indicates that TensorRT simplified the computational graph.

The reduction does **not** imply that exactly four layers disappeared.

Instead,

multiple graph transformations occurred.

Some operators fused.

Some became compile-time constants.

Others became unnecessary.

---

## Metric 2

![latency comparison between pytorch eager execution and tensorrt engine execution](https://i.postimg.cc/3rpDcjRy/Screenshot-From-2026-07-01-15-51-39.png)

Latency

```text
PyTorch

↓

1.2179 ms

TensorRT

↓

0.1053 ms
```

producing

```text
11.57×

speedup
```

This improvement comes from

* graph simplification
* fused kernels
* optimized scheduling
* kernel autotuning
* reduced Python overhead

Layer fusion is one contributor—not the only one.

---

# Errors and Fixes

| Error                                     | Root Cause                                                                                       | Fix                                                        | Why the Fix Worked                                   | Preventive Advice                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| `RuntimeError: [1,256] × [4096,128]`      | Incorrect Linear input size after pooling                                                        | Changed `Linear(4096,128)` to `Linear(256,128)`            | Flattened tensor actually contained 256 features     | Always compute feature map dimensions before defining Linear layers |
| ONNX version conversion warning           | Exporter produced opset 18 internally while a request for opset 11 triggered a downgrade attempt | Ignored conversion warning because export itself succeeded | The generated ONNX model was already valid           | Distinguish export failures from version-conversion warnings        |
| `EXPLICIT_BATCH` missing                  | TensorRT 11 removed implicit batch mode                                                          | Switched to the TensorRT 11 network creation API           | Explicit batching is now the default behavior        | Verify API compatibility before following older tutorials           |
| `BuilderFlag.FP16` missing                | TensorRT 11 uses strongly typed networks instead of precision builder flags                      | Removed deprecated FP16 configuration                      | Precision is determined differently in TensorRT 11   | Read migration guides when moving across major versions             |
| TensorRT engine larger than PyTorch model | Engine stores optimization metadata in addition to weights                                       | Removed storage footprint from the comparison              | Engine size is not a measure of optimization quality | Compare runtime metrics instead of serialized file sizes            |

---

# Engineering Decisions

## Why a Small CNN?

Large models obscure optimization behavior.

A small network makes every graph transformation easy to inspect.

---

## Why ONNX?

TensorRT is a compiler.

Compilers require a graph representation rather than Python source code.

---

## Why Measure ONNX Nodes?

ONNX represents the graph **before** TensorRT optimization.

It provides a baseline for measuring graph simplification.

---

## Why Measure TensorRT Layers?

The TensorRT engine represents the optimized execution graph.

Comparing it with ONNX quantifies structural optimization.

---

## Why Remove Engine Size?

Engine size depends on

* metadata
* kernels
* execution plans
* scheduling information

It is therefore a poor optimization metric.

---

# Key Learnings

* Layer fusion primarily reduces memory traffic rather than arithmetic operations.
* Compiler optimizations often matter more than raw hardware performance.
* Reading only the first line of an error message rarely reveals the true cause.
* Tensor dimensions should be tracked throughout the network instead of debugging only the failing layer.
* Major API versions often introduce conceptual changes, not just renamed functions.
* TensorRT engines are compiled executables, not serialized neural networks.

---

# Mental Models

## 1. TensorRT is a Compiler

Think of TensorRT exactly as you would think of GCC or LLVM.

```text
Source Code

↓

Compiler

↓

Executable
```

becomes

```text
ONNX

↓

TensorRT

↓

Engine
```

---

## 2. Graph Optimization Before Hardware Optimization

Never optimize CUDA kernels before simplifying the computation graph.

Removing unnecessary work is almost always more valuable than accelerating unnecessary work.

---

## 3. Memory Movement is Expensive

GPU performance is frequently limited by

```text
Memory

>

Arithmetic
```

Reducing memory transfers often produces larger speedups than reducing floating-point operations.

---

## 4. Read Stack Traces Bottom-Up

The deepest frame usually identifies the subsystem responsible.

The top of the traceback often contains only the symptom.

---

## 5. Version Numbers Do Not Guarantee API Compatibility

TensorRT 11 is not simply TensorRT 10 with additional features.

It introduces a different design philosophy.

Always verify APIs against the installed version rather than relying on older examples.

---

# Things Worth Remembering

* ONNX is an intermediate representation, not an execution engine.
* TensorRT compiles graphs rather than interpreting them.
* Engine size is not an optimization metric.
* Warm up GPU workloads before benchmarking.
* Synchronize CUDA before recording timings.
* Measure graph complexity and runtime separately.
* Always inspect tensor shapes after pooling layers.
* Deprecation warnings often signal architectural changes rather than missing functionality.

---

# Future Improvements

Several natural extensions can deepen this experiment.

1. Compare TensorRT optimization across different network architectures such as ResNet or MobileNet.

2. Visualize the ONNX graph using Netron before and after TensorRT optimization.

3. Measure CUDA kernel launches with NVIDIA Nsight Systems to directly observe fusion effects.

4. Investigate TensorRT dynamic shapes and optimization profiles.

5. Extend the benchmark to batch sizes larger than one and study throughput versus latency.

6. Compare TensorRT with TorchScript and `torch.compile` to understand how different compilation frameworks optimize the same model.

7. Build an FP16 ONNX model and study TensorRT 11's strongly typed execution pipeline.

---

# References

### Libraries

* PyTorch
* ONNX
* TensorRT 11.1
* CUDA Runtime
* Matplotlib

### NVIDIA Documentation

* TensorRT Python API
* TensorRT 11 Migration Guide
* TensorRT Developer Guide
* CUDA Programming Guide

### Visualization Tools

* Netron (ONNX graph visualization)
* NVIDIA Nsight Systems
* NVIDIA Nsight Compute

---

# Final Reflection

Although the network used in this experiment was intentionally small, the engineering workflow mirrors that of production deployment pipelines.

The process involved designing an architecture suitable for optimization, validating tensor dimensions, exporting an intermediate representation, adapting to a changing compiler API, generating a hardware-specific execution engine, and finally evaluating optimization through structural and runtime metrics.

The experiment demonstrated that meaningful performance improvements arise not from changing the mathematical function computed by the network, but from changing **how** that function is executed. TensorRT achieved this by transforming a graph of independent operations into a compact, optimized execution plan tailored to the underlying GPU, reducing graph complexity by **40%** and improving inference latency by approximately **11.6×** for this workload.
