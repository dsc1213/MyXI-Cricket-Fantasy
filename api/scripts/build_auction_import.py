#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from difflib import get_close_matches
from pathlib import Path


XML_NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
SUMMARY_ROWS = {
    "TOTAL SPENT",
    "REMAINING PURSE",
    "TOTAL PURSE",
    "PLAYERS BOUGHT",
    "TOTAL POINTS",
}
KNOWN_ALIASES = {
    "Abishek Porel": "Abishek Porel",
    "Philip Salt": "Phil Salt",
    "Vaibhav Sooryavanshi": "Vaibhav Suryavanshi",
    "Mitchell Owen": "Mitch Owen",
    "Ravisrinivasan Sai Kishore": "Sai Kishore",
    "Varun Chakaravarthy": "Varun Chakravarthy",
    "Mohammed Shami": "Mohammad Shami",
    "Manimaran Siddharth": "M Siddharth",
    "Digvesh Singh Rathi": "Digvesh Singh",
    "Vijaykumar Vyshak": "Vyshak Vijaykumar",
    "Praveen Dubey": "Pravin Dubey",
}


def slugify(value=""):
    return re.sub(r"[^a-z0-9]+", "-", str(value).strip().lower()).strip("-") or "auction-user"


def normalize_name(value=""):
    return re.sub(r"[^a-z0-9]+", " ", str(value).strip().lower()).strip()


def read_excel_rosters(excel_path):
    with zipfile.ZipFile(excel_path) as archive:
        shared_strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in shared_root.findall("a:si", XML_NS):
                shared_strings.append(
                    "".join(node.text or "" for node in item.iterfind(".//a:t", XML_NS))
                )

        workbook_root = ET.fromstring(archive.read("xl/workbook.xml"))
        rels_root = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels_root}

        participants = []
        for sheet in workbook_root.find("a:sheets", XML_NS):
            sheet_name = sheet.attrib["name"]
            if sheet_name == "Unsold Players":
                continue
            rel_id = sheet.attrib[
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
            ]
            worksheet_root = ET.fromstring(archive.read("xl/" + rel_map[rel_id]))
            rows = worksheet_root.find("a:sheetData", XML_NS).findall("a:row", XML_NS)
            roster = []
            for row in rows[1:]:
                values = {}
                for cell in row.findall("a:c", XML_NS):
                    ref = cell.attrib.get("r", "")
                    col_match = re.match(r"[A-Z]+", ref)
                    if not col_match:
                        continue
                    col = col_match.group(0)
                    cell_type = cell.attrib.get("t")
                    value_node = cell.find("a:v", XML_NS)
                    value = ""
                    if value_node is not None:
                        value = value_node.text or ""
                        if cell_type == "s":
                            value = shared_strings[int(value)]
                    else:
                        inline = cell.find("a:is", XML_NS)
                        if inline is not None:
                            value = "".join(
                                node.text or "" for node in inline.iterfind(".//a:t", XML_NS)
                            )
                    values[col] = value
                player_name = (values.get("B") or "").strip()
                if not player_name or player_name in SUMMARY_ROWS:
                    continue
                roster.append(player_name)
            participants.append(
                {
                    "userId": slugify(sheet_name),
                    "name": sheet_name,
                    "roster": roster,
                }
            )
        return participants


def request_json(url, method="GET", payload=None, token=None):
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def login(api_base, login_id, password):
    payload = request_json(
        f"{api_base.rstrip('/')}/auth/login",
        method="POST",
        payload={"userId": login_id, "password": password},
    )
    token = payload.get("token")
    if not token:
        raise RuntimeError("Login succeeded but no token was returned by /auth/login")
    return token


def load_tournament_player_lookup(api_base, token, tournament_id):
    rows = request_json(
        f"{api_base.rstrip('/')}/admin/team-squads?tournamentId={tournament_id}",
        token=token,
    )
    if not isinstance(rows, list) or not rows:
        raise RuntimeError(
            f"No team squads returned for tournamentId={tournament_id}. "
            "Make sure squads were uploaded for that tournament."
        )

    lookup = {}
    canonical_names = []
    for squad in rows:
        for player in squad.get("squad") or []:
            canonical_name = (player.get("name") or "").strip()
            if not canonical_name:
                continue
            key = normalize_name(canonical_name)
            if key and key not in lookup:
                lookup[key] = canonical_name
                canonical_names.append(canonical_name)
    if not lookup:
        raise RuntimeError(
            f"No players found in /admin/team-squads for tournamentId={tournament_id}"
        )
    return lookup, canonical_names


def map_rosters(participants, lookup, canonical_names):
    unresolved = []
    mapped_participants = []
    normalized_canonical = {normalize_name(name): name for name in canonical_names}

    for participant in participants:
        mapped_roster = []
        for original_name in participant.get("roster") or []:
            alias_name = KNOWN_ALIASES.get(original_name, original_name)
            normalized = normalize_name(alias_name)
            canonical = lookup.get(normalized) or normalized_canonical.get(normalized)
            if not canonical:
                suggestions = get_close_matches(
                    alias_name,
                    canonical_names,
                    n=3,
                    cutoff=0.72,
                )
                unresolved.append(
                    {
                        "participant": participant.get("name"),
                        "sourceName": original_name,
                        "aliasTried": alias_name if alias_name != original_name else "",
                        "suggestions": suggestions,
                    }
                )
                continue
            mapped_roster.append(canonical)
        mapped_participants.append(
            {
                "userId": participant.get("userId"),
                "name": participant.get("name"),
                "roster": mapped_roster,
            }
        )
    return mapped_participants, unresolved


def build_arg_parser():
    parser = argparse.ArgumentParser(
        description=(
            "Build an auction import JSON from an Excel workbook by mapping roster names "
            "against the live tournament player pool from the API."
        )
    )
    parser.add_argument("--excel", required=True, help="Absolute path to the auction XLSX file")
    parser.add_argument("--tournament-id", required=True, help="Tournament id in MyXI")
    parser.add_argument("--contest-name", required=True, help="Auction contest name to create")
    parser.add_argument("--output", required=True, help="Output JSON file path")
    parser.add_argument(
        "--api-base",
        default=os.environ.get("AUCTION_IMPORT_API_BASE", "http://127.0.0.1:4000"),
        help="API base URL, default http://127.0.0.1:4000",
    )
    parser.add_argument(
        "--login",
        default=os.environ.get("AUCTION_IMPORT_LOGIN")
        or os.environ.get("PW_E2E_MASTER_LOGIN"),
        help="Admin/master login id for /auth/login",
    )
    parser.add_argument(
        "--password",
        default=os.environ.get("AUCTION_IMPORT_PASSWORD")
        or os.environ.get("PW_E2E_MASTER_PASSWORD"),
        help="Admin/master password for /auth/login",
    )
    parser.add_argument(
        "--report",
        default="",
        help="Optional mismatch report JSON path. Defaults to <output>.report.json",
    )
    return parser


def main():
    parser = build_arg_parser()
    args = parser.parse_args()

    excel_path = Path(args.excel).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    report_path = (
      Path(args.report).expanduser().resolve()
      if args.report
      else output_path.with_suffix(output_path.suffix + ".report.json")
    )

    if not excel_path.exists():
        print(f"Excel file not found: {excel_path}", file=sys.stderr)
        return 1
    if not args.login or not args.password:
        print(
            "Missing credentials. Pass --login/--password or set "
            "AUCTION_IMPORT_LOGIN and AUCTION_IMPORT_PASSWORD.",
            file=sys.stderr,
        )
        return 1

    try:
        token = login(args.api_base, args.login, args.password)
        lookup, canonical_names = load_tournament_player_lookup(
            args.api_base, token, args.tournament_id
        )
        participants = read_excel_rosters(excel_path)
        mapped_participants, unresolved = map_rosters(participants, lookup, canonical_names)

        report = {
            "excel": str(excel_path),
            "tournamentId": args.tournament_id,
            "contestName": args.contest_name,
            "participantCount": len(participants),
            "mappedParticipantCount": len(mapped_participants),
            "unresolvedCount": len(unresolved),
            "unresolved": unresolved,
        }
        report_path.write_text(json.dumps(report, indent=2))

        if unresolved:
            print(
                f"Found {len(unresolved)} unresolved player names. "
                f"Review {report_path} before importing.",
                file=sys.stderr,
            )
            return 2

        payload = {
            "tournamentId": args.tournament_id,
            "contestName": args.contest_name,
            "participants": mapped_participants,
        }
        output_path.write_text(json.dumps(payload, indent=2))
        print(f"Wrote {output_path}")
        print(f"Report: {report_path}")
        print(f"Participants: {len(mapped_participants)}")
        return 0
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        print(f"HTTP {error.code}: {body}", file=sys.stderr)
        return 1
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
