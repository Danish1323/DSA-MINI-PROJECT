import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { nodes, edges } = data;

    // Build the input string for the C++ binary
    // Format:
    // N M
    // u v
    let input = `${nodes} ${edges.length}\n`;
    for (const edge of edges) {
      input += `${edge.u} ${edge.v}\n`;
    }

    const executablePath = path.resolve('../cpp_engine/graph_analyzer');

    return new Promise((resolve) => {
      const child = exec(executablePath, (error, stdout, stderr) => {
        if (error) {
          console.error("Exec error:", error);
          return resolve(NextResponse.json({ error: 'Failed to run algorithm', details: error.message }, { status: 500 }));
        }

        try {
          const parsed = JSON.parse(stdout);
          resolve(NextResponse.json(parsed));
        } catch (e) {
          console.error("JSON parse error:", e);
          console.error("Raw output:", stdout);
          resolve(NextResponse.json({ error: 'Failed to parse algorithm output', raw: stdout }, { status: 500 }));
        }
      });

      if (child.stdin) {
        child.stdin.write(input);
        child.stdin.end();
      }
    });

  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
