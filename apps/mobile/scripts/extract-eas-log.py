#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: extract-eas-log.py <build-json-path> <output-log-path>")
        return 2

    build_json_path = Path(sys.argv[1])
    output_log_path = Path(sys.argv[2])

    data = json.loads(build_json_path.read_text())
    urls = data.get("logFiles", [])

    output_log_path.write_text("")

    for url in urls:
        result = subprocess.run(
            ["curl", "-sL", url],
            capture_output=True,
            text=True,
            check=False,
        )
        for raw in result.stdout.splitlines():
            line = raw.strip()
            if not line:
                continue
            try:
                msg = json.loads(line).get("msg", "")
            except Exception:
                continue
            if msg:
                with output_log_path.open("a") as f:
                    f.write(msg + "\n")

    print(f"Wrote parsed logs to: {output_log_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
