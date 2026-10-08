"""
Phase 3C-3 Performance Benchmarking: executeCopilotPlan Hybrid Orchestration
Benchmarks:
1. Single read-only tool (getMyInventory)
2. Multiple read-only tools (getMyInventory, getPriceIntelligence, getDemandIntelligence)
3. Near-limit valid plan (10 steps: combination of getMyInventory & getPriceIntelligence)

5 warm runs per benchmark scenario.
"""

import asyncio
import statistics
import time
from app.tools.dispatcher import dispatch_tool

TEST_USER = {
    "id": 1,
    "role": "farmer",
    "email": "farmer@example.com",
    "name": "Test Farmer"
}

SCENARIOS = {
    "1. Single Read-Only Tool": [
        {"toolName": "getMyInventory", "params": {}, "description": "Check inventory"}
    ],
    "2. Multiple Read-Only Tools (3 Steps)": [
        {"toolName": "getMyInventory", "params": {}, "description": "Check inventory"},
        {"toolName": "getPriceIntelligence", "params": {"commodity": "Tomato"}, "description": "Check price trends"},
        {"toolName": "getDemandIntelligence", "params": {"commodity": "Tomato"}, "description": "Check buyer demand"},
    ],
    "3. Near-Limit Valid Plan (10 Steps)": [
        {"toolName": "getMyInventory", "params": {}, "description": f"Step {i+1} Inventory check"}
        if i % 2 == 0 else
        {"toolName": "getPriceIntelligence", "params": {"commodity": "Tomato"}, "description": f"Step {i+1} Price check"}
        for i in range(10)
    ]
}

async def run_benchmark():
    print("=" * 70)
    print("PHASE 3C-3: EXECUTECOPILOTPLAN ORCHESTRATION BENCHMARK (5 WARM RUNS)")
    print("=" * 70)

    # Warmup run to prime connections and caches
    print("Warming up connections and pools...")
    await dispatch_tool(TEST_USER, "executeCopilotPlan", {
        "customSteps": [{"toolName": "getMyInventory", "params": {}}]
    })

    results = {}

    for name, steps in SCENARIOS.items():
        latencies = []
        tool_calls_counts = []
        print(f"\nBenchmarking Scenario: {name} (Steps: {len(steps)})...")
        
        for run_idx in range(5):
            t0 = time.perf_counter()
            res = await dispatch_tool(TEST_USER, "executeCopilotPlan", {
                "customSteps": steps
            })
            duration_ms = (time.perf_counter() - t0) * 1000.0
            assert res.success is True, f"Benchmark failed: {res.error}"
            latencies.append(duration_ms)
            tool_calls_counts.append(res.data.get("totalToolCalls", 0))
            print(f"  Run {run_idx+1}: {duration_ms:.2f} ms (tool calls: {res.data.get('totalToolCalls')})")

        avg_lat = statistics.mean(latencies)
        min_lat = min(latencies)
        max_lat = max(latencies)
        median_lat = statistics.median(latencies)
        stdev_lat = statistics.stdev(latencies) if len(latencies) > 1 else 0.0

        results[name] = {
            "steps": len(steps),
            "tool_calls": tool_calls_counts[0],
            "avg_ms": avg_lat,
            "min_ms": min_lat,
            "max_ms": max_lat,
            "median_ms": median_lat,
            "stdev_ms": stdev_lat,
            "latencies": latencies
        }

    print("\n" + "=" * 70)
    print("BENCHMARK SUMMARY RESULTS TABLE")
    print("=" * 70)
    print(f"{'Scenario':<38} | {'Steps':<5} | {'Calls':<5} | {'Avg (ms)':<9} | {'Min (ms)':<9} | {'Max (ms)':<9}")
    print("-" * 70)
    for name, r in results.items():
        print(f"{name:<38} | {r['steps']:<5} | {r['tool_calls']:<5} | {r['avg_ms']:<9.2f} | {r['min_ms']:<9.2f} | {r['max_ms']:<9.2f}")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_benchmark())
