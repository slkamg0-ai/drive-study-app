"""
PDF 기출문제 자동 변환 도구 (pdf_to_exam.py)
사용법:
    py pdf_to_exam.py "기출문제.pdf" [출력파일명.json]
"""

import sys
import os
import re
import json
from pypdf import PdfReader

def extract_pdf_exam(pdf_path, output_json=None):
    if not os.path.exists(pdf_path):
        print(f"[오류] 파일이 존재하지 않습니다: {pdf_path}")
        return

    print(f"[*] PDF 파일 분석 시작: {pdf_path}")
    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)
    print(f"[*] 총 페이지 수: {total_pages}")

    full_text = ""
    for idx, page in enumerate(reader.pages):
        text = page.extract_text()
        full_text += f"\n---PAGE_{idx+1}---\n" + text

    # 1. 답안표 추출 (보통 마지막 페이지에 위치)
    answer_map = {}
    ans_tokens = re.findall(r'[①②③④]', full_text)
    # 마지막 100개 또는 답안표 패턴 탐색
    if len(ans_tokens) >= 100:
        last_answers = ans_tokens[-100:]
        for idx, sym in enumerate(last_answers):
            q_num = idx + 1
            num_val = 1
            if sym == '①': num_val = 1
            elif sym == '②': num_val = 2
            elif sym == '③': num_val = 3
            elif sym == '④': num_val = 4
            answer_map[q_num] = num_val

    # 2. 문제 및 보기 파싱
    # 문제 패턴: 1. ... 2. ...
    q_blocks = re.findall(r'(?:^|\n)\s*(\d{1,3})\s*\.\s+([\s\S]*?)(?=(?:\n\s*\d{1,3}\s*\.\s+|$|\n\s*최강\s*자격증|\n\s*전자문제집))', full_text)
    
    questions = []
    subject_map = {
        (1, 20): "1과목",
        (21, 40): "2과목",
        (41, 60): "3과목",
        (61, 80): "4과목",
        (81, 100): "5과목"
    }

    seen_ids = set()
    for q_id_str, raw_body in q_blocks:
        q_id = int(q_id_str)
        if q_id in seen_ids or q_id > 100:
            continue
        seen_ids.add(q_id)

        clean_body = re.sub(r'전자문제집\s*CBT[\s\S]*?www\.comcbt\.com', '', raw_body)
        clean_body = re.sub(r'최강\s*자격증[\s\S]*?www\.comcbt\.com', '', clean_body)

        # 보기 분리 (①, ②, ③, ④)
        opt_match = re.search(r'([①1\(\[]\s*[\s\S]*?[②2\(\[]\s*[\s\S]*?[③3\(\[]\s*[\s\S]*?[④4\(\[]\s*[\s\S]*)', clean_body)
        q_text = clean_body
        options = []

        if opt_match:
            q_text = clean_body[:opt_match.start()].strip()
            opt_str = opt_match.group(1).strip()
            # 4개 보기 추출
            parts = re.split(r'[①②③④]', opt_str)
            if len(parts) >= 5:
                options = [
                    f"① {parts[1].strip()}",
                    f"② {parts[2].strip()}",
                    f"③ {parts[3].strip()}",
                    f"④ {parts[4].strip()}"
                ]

        if not options:
            options = ["① 1번 보기", "② 2번 보기", "③ 3번 보기", "④ 4번 보기"]

        ans_num = answer_map.get(q_id, 1)
        ans_text = f"{ans_num}번"
        if len(options) >= ans_num:
            ans_text = options[ans_num - 1]

        # 해설 추출: 원문에 [해설], [풀이] 등이 있는지 검사
        exp_match = re.search(r'(?:\[\s*(?:해설|풀이|정답과\s*해설|정답및해설|오답노트|오답피하기|참고)\s*\]|해설\s*[:\.]|풀이\s*[:\.]|※\s*해설|★\s*해설)\s*([\s\S]*?)$', clean_body, re.I)
        explanation = ""
        if exp_match and len(exp_match.group(1).strip()) > 3:
            explanation = exp_match.group(1).strip()
        else:
            # 지능형 해설 자동 생성 (해설 없는 PDF 대응)
            is_negative = bool(re.search(r'(?:옳지\s*않은|틀린|아닌|거리\s*가\s*먼|해당하지\s*않는|불가능한|없는)', q_text))
            ans_clean = re.sub(r'^[①②③④\d\.\)\s]+', '', ans_text).strip()
            if is_negative:
                other_opts = [re.sub(r'^[①②③④\d\.\)\s]+', '', o).strip() for idx, o in enumerate(options) if idx != (ans_num - 1)][:2]
                explanation = f"정답은 {ans_num}번, '{ans_clean}' 입니다. 문제에서 옳지 않거나 틀린 항목을 묻고 있으므로 {ans_num}번이 틀린 설명입니다. 나머지 보기('{other_opts[0]}', '{other_opts[1]}' 등)는 올바른 설명에 해당합니다."
            else:
                explanation = f"정답은 {ans_num}번, '{ans_clean}' 입니다. 문제의 조건과 출제 의도에 가장 올바르게 부합하는 정답입니다."

        # 과목명
        subj_name = "기출과목"
        for (start_id, end_id), sname in subject_map.items():
            if start_id <= q_id <= end_id:
                subj_name = sname
                break

        questions.append({
            "id": q_id,
            "subject": subj_name,
            "question": q_text.strip(),
            "options": options,
            "answer": ans_num,
            "answerText": ans_text,
            "explanation": explanation
        })

    questions.sort(key=lambda x: x["id"])
    print(f"[+] 총 {len(questions)}개 문제 변환 완료!")

    if not output_json:
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        output_json = f"{base_name}.json"

    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)

    print(f"[완료] 결과 파일 저장: {output_json}")
    print(f"-> 이제 드라이브 런 웹앱의 [문제집 관리]에서 위 JSON 파일을 불러오시면 됩니다!")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법: py pdf_to_exam.py <PDF파일경로> [출력JSON경로]")
        print("예시: py pdf_to_exam.py my_exam.pdf")
    else:
        pdf_file = sys.argv[1]
        out_file = sys.argv[2] if len(sys.argv) > 2 else None
        extract_pdf_exam(pdf_file, out_file)
