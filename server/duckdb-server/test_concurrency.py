#!/usr/bin/env python3
"""
Test script to verify the DuckDB server concurrency optimizations.
This script will send multiple concurrent requests to test that they don't block each other.
"""

import asyncio
import aiohttp
import json
import time
import tempfile
import os
import subprocess
from pathlib import Path

async def send_query(session, port, query, query_id):
    """Send a query over WebSocket and measure response time."""
    start_time = time.time()

    qid = f"q_{query_id}_{int(start_time*1000)}"
    payload = {
        "type": "arrow",
        "sql": query,
        "queryId": qid,
    }

    try:
        async with session.ws_connect(f'ws://localhost:{port}') as ws:
            await ws.send_str(json.dumps(payload))
            # Wait for correlated response
            while True:
                msg = await ws.receive()
                if msg.type == aiohttp.WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                    except Exception:
                        continue
                    if not isinstance(data, dict):
                        continue
                    if data.get("type") == "error" and data.get("queryId") == qid:
                        elapsed = (time.time() - start_time) * 1000
                        print(f"Query {query_id}: {elapsed:.1f}ms - ERROR: {data.get('error')}")
                        return elapsed, False
                    # ignore unrelated messages (e.g., other queries or cancel acks)
                elif msg.type == aiohttp.WSMsgType.BINARY:
                    # Decode [4-byte BE len][header JSON][Arrow bytes]
                    buf = msg.data
                    if len(buf) < 4:
                        continue
                    header_len = int.from_bytes(buf[0:4], byteorder='big')
                    header_start = 4
                    header_end = header_start + header_len
                    if header_end > len(buf):
                        continue
                    try:
                        header = json.loads(buf[header_start:header_end].decode('utf-8'))
                    except Exception:
                        continue
                    if header.get('type') != 'arrow' or header.get('queryId') != qid:
                        continue
                    # We received the matching result
                    elapsed = (time.time() - start_time) * 1000
                    print(f"Query {query_id}: {elapsed:.1f}ms - OK (binary)")
                    return elapsed, True
                elif msg.type in (aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.CLOSING):
                    elapsed = (time.time() - start_time) * 1000
                    print(f"Query {query_id}: {elapsed:.1f}ms - ERROR: websocket closed")
                    return elapsed, False
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    elapsed = (time.time() - start_time) * 1000
                    print(f"Query {query_id}: {elapsed:.1f}ms - ERROR: {ws.exception()}")
                    return elapsed, False
    except Exception as e:
        elapsed = (time.time() - start_time) * 1000
        print(f"Query {query_id}: {elapsed:.1f}ms - ERROR: {str(e)}")
        return elapsed, False

async def test_concurrency(port=30001):
    """Test that multiple queries can run concurrently."""
    print("Testing DuckDB server concurrency...")
    
    # Create test queries that take some time
    queries = [
        "SELECT COUNT(*) FROM generate_series(1, 1000000)",  # Query 1
        "SELECT SUM(x) FROM generate_series(1, 1000000) as t(x)",  # Query 2  
        "SELECT AVG(x::float) FROM generate_series(1, 1000000) as t(x)",  # Query 3
        "SELECT MAX(x) FROM generate_series(1, 1000000) as t(x)",  # Query 4
        "SELECT MIN(x) FROM generate_series(1, 1000000) as t(x)",  # Query 5
    ]
    
    async with aiohttp.ClientSession() as session:
        print("Sending 5 concurrent queries...")
        start_time = time.time()
        
        # Send all queries concurrently
        tasks = [
            send_query(session, port, query, i+1) 
            for i, query in enumerate(queries)
        ]
        
        results = await asyncio.gather(*tasks)
        
        total_time = (time.time() - start_time) * 1000
        print(f"\nTotal time for all queries: {total_time:.1f}ms")
        
        # Calculate stats
        response_times = [r[0] for r in results]
        successful = [r[1] for r in results]
        
        print(f"Successful queries: {sum(successful)}/{len(successful)}")
        print(f"Average response time: {sum(response_times)/len(response_times):.1f}ms")
        print(f"Min response time: {min(response_times):.1f}ms")
        print(f"Max response time: {max(response_times):.1f}ms")
        
        # If queries were truly concurrent, total time should be close to max individual time
        max_individual = max(response_times)
        concurrency_ratio = max_individual / total_time
        print(f"Concurrency ratio: {concurrency_ratio:.2f} (closer to 1.0 = better concurrency)")
        
        return all(successful) and concurrency_ratio > 0.7  # 70% efficiency threshold

def start_test_server(port=30001):
    """Start a test DuckDB server."""
    # Create a temporary database file
    temp_db = tempfile.NamedTemporaryFile(suffix='.duckdb', delete=False)
    temp_db.close()
    
    print(f"Starting test server on port {port} with database: {temp_db.name}")
    
    # Start the server
    process = subprocess.Popen([
        'python', '-m', 'pkg', 
        '--db-path', temp_db.name,
        '--port', str(port)
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    # Give the server time to start
    time.sleep(3)
    
    return process, temp_db.name

async def main():
    """Main test function."""
    port = 30001
    server_process = None
    temp_db_path = None
    
    try:
        # Start test server
        server_process, temp_db_path = start_test_server(port)
        
        if server_process.poll() is not None:
            stdout, stderr = server_process.communicate()
            print(f"Server failed to start!")
            print(f"STDOUT: {stdout.decode()}")
            print(f"STDERR: {stderr.decode()}")
            return False
        
        print("Server started successfully")
        
        # Wait a bit more for full startup
        await asyncio.sleep(2)
        
        # Run concurrency test
        success = await test_concurrency(port)
        
        if success:
            print("\n✅ Concurrency test PASSED!")
            print("The DuckDB server is properly handling concurrent requests.")
        else:
            print("\n❌ Concurrency test FAILED!")
            print("The server may not be handling concurrent requests efficiently.")
        
        return success
        
    except Exception as e:
        print(f"Test failed with exception: {e}")
        return False
        
    finally:
        # Cleanup
        if server_process:
            try:
                # Try graceful shutdown first
                import requests
                requests.post(f'http://localhost:{port}/shutdown', timeout=5)
                time.sleep(1)
            except:
                pass
            
            # Force kill if still running
            if server_process.poll() is None:
                server_process.terminate()
                server_process.wait(timeout=5)
        
        # Remove temp database
        if temp_db_path and os.path.exists(temp_db_path):
            os.unlink(temp_db_path)

if __name__ == "__main__":
    result = asyncio.run(main())
    exit(0 if result else 1) 