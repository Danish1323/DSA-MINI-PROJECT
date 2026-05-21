import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { packages } = data;

    // Build the input string for the C++ binary
    // Format:
    // N (number of packages)
    // id cost time
    let input = `${packages.length}\n`;
    for (const pkg of packages) {
      input += `${pkg.id} ${pkg.cost} ${pkg.time}\n`;
    }

    const executablePath = path.resolve('../cpp_engine/greedy_assigner');

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
