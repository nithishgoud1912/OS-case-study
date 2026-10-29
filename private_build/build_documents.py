from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(r'C:\Users\HP\Documents\OS record\OS CASE STUDY\case_study_14_rebuild')
OUT = ROOT / 'output'
CODE = (ROOT / 'src' / 'race_demo.c').read_text(encoding='ascii')
NAVY = '17324D'
TEAL = '087E8B'
PALE = 'EAF3F4'
LIGHT = 'F2F5F7'
MID = '536675'
WHITE = 'FFFFFF'

TEAM = [
    ('L Nithish Kumar Goud', '160124733327'),
    ('G Ishan', '160124733322'),
    ('Santhosh', '160124733332'),
    ('Venkat', '160124733340'),
]

def set_cell_shading(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = tcPr.find(qn('w:shd'))
    if shd is None:
        shd = OxmlElement('w:shd')
        tcPr.append(shd)
    shd.set(qn('w:fill'), fill)

def set_cell_margins(cell, top=80, start=100, bottom=80, end=100):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcMar = tcPr.first_child_found_in('w:tcMar')
    if tcMar is None:
        tcMar = OxmlElement('w:tcMar')
        tcPr.append(tcMar)
    for edge, value in [('top', top), ('start', start), ('bottom', bottom), ('end', end)]:
        node = tcMar.find(qn(f'w:{edge}'))
        if node is None:
            node = OxmlElement(f'w:{edge}')
            tcMar.append(node)
        node.set(qn('w:w'), str(value))
        node.set(qn('w:type'), 'dxa')

def set_repeat_table_header(row):
    trPr = row._tr.get_or_add_trPr()
    tblHeader = OxmlElement('w:tblHeader')
    tblHeader.set(qn('w:val'), 'true')
    trPr.append(tblHeader)

def set_table_borders(table, color='CFD9DF', size='6'):
    tbl = table._tbl
    tblPr = tbl.tblPr
    borders = tblPr.first_child_found_in('w:tblBorders')
    if borders is None:
        borders = OxmlElement('w:tblBorders')
        tblPr.append(borders)
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        tag = f'w:{edge}'
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn('w:val'), 'single')
        element.set(qn('w:sz'), size)
        element.set(qn('w:space'), '0')
        element.set(qn('w:color'), color)

def add_page_field(paragraph):
    run = paragraph.add_run()
    fldChar1 = OxmlElement('w:fldChar')
    fldChar1.set(qn('w:fldCharType'), 'begin')
    instrText = OxmlElement('w:instrText')
    instrText.set(qn('xml:space'), 'preserve')
    instrText.text = ' PAGE '
    fldChar2 = OxmlElement('w:fldChar')
    fldChar2.set(qn('w:fldCharType'), 'end')
    run._r.append(fldChar1)
    run._r.append(instrText)
    run._r.append(fldChar2)

def set_run_font(run, name='Arial', size=10.5, color=NAVY, bold=False, italic=False):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn('w:ascii'), name)
    run._element.get_or_add_rPr().rFonts.set(qn('w:hAnsi'), name)
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor.from_string(color)
    run.bold = bold
    run.italic = italic

def setup_document(doc, label):
    sec = doc.sections[0]
    sec.page_width = Inches(8.27)
    sec.page_height = Inches(11.69)
    sec.top_margin = Inches(0.72)
    sec.bottom_margin = Inches(0.72)
    sec.left_margin = Inches(0.78)
    sec.right_margin = Inches(0.78)
    normal = doc.styles['Normal']
    normal.font.name = 'Arial'
    normal._element.rPr.rFonts.set(qn('w:ascii'), 'Arial')
    normal._element.rPr.rFonts.set(qn('w:hAnsi'), 'Arial')
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(NAVY)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.12
    for style_name, size, color in [('Title', 28, NAVY), ('Heading 1', 17, NAVY), ('Heading 2', 12.5, TEAL)]:
        style = doc.styles[style_name]
        style.font.name = 'Arial'
        style._element.rPr.rFonts.set(qn('w:ascii'), 'Arial')
        style._element.rPr.rFonts.set(qn('w:hAnsi'), 'Arial')
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(color)
        style.paragraph_format.keep_with_next = True
        style.paragraph_format.space_before = Pt(12 if style_name != 'Title' else 0)
        style.paragraph_format.space_after = Pt(5)
    header = sec.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    header.text = f'CASE STUDY 14  |  {label.upper()}'
    for run in header.runs:
        set_run_font(run, size=8, color=MID, bold=True)
    footer = sec.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = footer.add_run('Operating Systems  |  Department of CSE  |  Page ')
    set_run_font(r, size=8, color=MID)
    add_page_field(footer)
    for run in footer.runs[1:]:
        set_run_font(run, size=8, color=MID)

def add_para(doc, text='', bold_prefix=None, style=None):
    p = doc.add_paragraph(style=style)
    if bold_prefix and text.startswith(bold_prefix):
        r = p.add_run(bold_prefix)
        set_run_font(r, bold=True)
        r = p.add_run(text[len(bold_prefix):])
        set_run_font(r)
    else:
        r = p.add_run(text)
        set_run_font(r)
    return p

def add_bullet(doc, text):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_after = Pt(3)
    r = p.add_run(text)
    set_run_font(r)
    return p

def add_table(doc, headers, rows, widths=None, font_size=9.2):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)
    for i, head in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = head
        set_cell_shading(cell, NAVY)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        set_cell_margins(cell)
        for p in cell.paragraphs:
            p.paragraph_format.space_after = Pt(0)
            for run in p.runs:
                set_run_font(run, size=font_size, color=WHITE, bold=True)
    set_repeat_table_header(table.rows[0])
    for ridx, row in enumerate(rows):
        cells = table.add_row().cells
        for i, value in enumerate(row):
            cells[i].text = str(value)
            cells[i].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_margins(cells[i])
            if ridx % 2 == 1:
                set_cell_shading(cells[i], LIGHT)
            for p in cells[i].paragraphs:
                p.paragraph_format.space_after = Pt(0)
                for run in p.runs:
                    set_run_font(run, size=font_size)
    if widths:
        for row in table.rows:
            for i, width in enumerate(widths):
                row.cells[i].width = Inches(width)
    set_table_borders(table)
    return table

def add_caption(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(3)
    p.paragraph_format.space_after = Pt(7)
    r = p.add_run(text)
    set_run_font(r, size=8.5, color=MID, italic=True)

def add_code_block(doc, text, font_size=8.2, shade='F4F6F8'):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(table, color='D7E0E5', size='4')
    cell = table.cell(0, 0)
    set_cell_shading(cell, shade)
    set_cell_margins(cell, top=100, start=130, bottom=100, end=130)
    cell.text = ''
    for index, line in enumerate(text.rstrip('\n').splitlines()):
        p = cell.paragraphs[0] if index == 0 else cell.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.0
        p.paragraph_format.keep_together = False
        run = p.add_run(line if line else ' ')
        set_run_font(run, name='Consolas', size=font_size, color='243746')
    return table

def add_heading(doc, text, level=1):
    p = doc.add_paragraph(text, style=f'Heading {level}')
    return p

def add_cover(doc, subtitle):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(74)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run('CASE STUDY 14')
    set_run_font(r, size=14, color=TEAL, bold=True)
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run('Race Condition in\nxv6 Shared Data')
    set_run_font(r, size=29, color=NAVY, bold=True)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(8)
    r = p.add_run(subtitle)
    set_run_font(r, size=13, color=MID)
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(22)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run('Operating Systems  |  Department of CSE')
    set_run_font(r, size=11, color=TEAL, bold=True)
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(34)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run('Chaitanya Bharathi Institute of Technology')
    set_run_font(r, size=13, color=NAVY, bold=True)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run('Prepared by')
    set_run_font(r, size=10, color=MID)
    add_table(doc, ['Student', 'Roll number'], TEAM, widths=[4.1, 2.5], font_size=9)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(22)
    r = p.add_run('27 October 2026')
    set_run_font(r, size=9, color=MID)
    doc.add_page_break()

def build_report(path):
    doc = Document()
    setup_document(doc, 'Project Report')
    add_cover(doc, 'A runnable C model of a free-list race and its spinlock fix')

    add_heading(doc, '1. Case statement and scope')
    add_para(doc, 'The assignment asks how concurrent access to shared kernel data can produce inconsistent updates, and how xv6 locking prevents them. This project studies the physical-page free list, kmem.freelist, and follows one synchronization method: a spinlock. [1]')
    add_para(doc, 'The deliverable includes a runnable host-side C model and a source-level comparison with xv6. The C program forces a specific two-thread interleaving, observes the duplicate allocation, then repeats the pop operation with a spinlock. It does not boot xv6 or change the xv6 kernel source.')
    add_heading(doc, 'Objectives covered', level=2)
    for text in [
        'Explain the shared free-list data and the invariant it must preserve.',
        'Show a critical section where each allocation reads and changes the same head pointer.',
        'Reproduce a duplicate allocation in a controlled unlocked run.',
        'Protect the complete list pop with one spinlock and compare the resulting state.',
    ]:
        add_bullet(doc, text)

    add_heading(doc, '2. Shared data and its invariant')
    add_para(doc, 'In xv6, kmem.freelist points to the first free physical page. Each page stores a link to the next page. kalloc() removes the first page; kfree() inserts a page at the head. Both operations use kmem.lock around the list changes in the local xv6 source. [2]')
    add_table(doc, ['State', 'Required condition'], [
        ('Free page', 'Appears exactly once in the reachable free list.'),
        ('Allocated page', 'Is returned to one caller at a time.'),
        ('Whole allocator state', 'Each page belongs to either the free list or one allocation.'),
    ], widths=[1.7, 4.9], font_size=9.1)
    add_caption(doc, 'Table 1. The allocator invariant checked by the C demonstration.')
    add_heading(doc, 'Relevant xv6 kalloc() operation', level=2)
    add_code_block(doc, 'acquire(&kmem.lock);\nr = kmem.freelist;\nif (r)\n  kmem.freelist = r->next;\nrelease(&kmem.lock);', font_size=9)
    add_para(doc, 'The lock must cover both the read and the head update. Protecting only one pointer access would still let a second CPU act on a stale head.')

    add_heading(doc, '3. Inconsistent update without the lock')
    add_para(doc, 'Assume the list begins P0 -> P1 -> P2. If two CPU threads read the head before either advances it, both hold P0 as their candidate. Each then stores P1 as the new head and returns P0. The list head is advanced, but two callers now believe they own the same physical page.')
    race_rows = [
        ('1', 'Read head: P0', '-', 'P0 -> P1 -> P2'),
        ('2', '-', 'Read head: P0', 'P0 -> P1 -> P2'),
        ('3', 'Store head: P1', '-', 'P1 -> P2'),
        ('4', '-', 'Store head: P1', 'P1 -> P2'),
        ('5', 'Return P0', 'Return P0', 'P0 has two owners'),
    ]
    add_table(doc, ['Step', 'CPU 0', 'CPU 1', 'Shared state'], race_rows,
              widths=[0.55, 1.75, 1.75, 2.55], font_size=8.7)
    add_caption(doc, 'Table 2. A possible source-level interleaving. It is the schedule forced by the host demo, not an xv6 hardware trace.')
    add_para(doc, 'Possible impact: duplicate page ownership can expose two processes to the same physical memory, while other lost or damaged list updates can make a free page unreachable. The C demo specifically reproduces duplicate allocation; it does not claim to reproduce every allocator failure.')

    add_heading(doc, '4. One method: xv6-style spinlock')
    add_para(doc, 'The spinlock gives one CPU exclusive access to the free-list critical section. The first CPU acquires the lock, reads P0, advances the head to P1, then releases the lock. The second CPU acquires the lock afterward and reads P1. The lock therefore protects the invariant across the complete read-modify-write operation. [2, 3]')
    add_table(doc, ['Phase', 'Protected action'], [
        ('Acquire', 'Claim kmem.lock with atomic ownership and acquire ordering.'),
        ('Critical section', 'Read the head and link the removed page out of the list.'),
        ('Release', 'Publish the completed update before another CPU enters.'),
    ], widths=[1.45, 5.15], font_size=9.1)
    add_caption(doc, 'Table 3. The spinlock sequence used by xv6 and mirrored in the program.')
    add_para(doc, 'The local xv6 spinlock implementation uses an atomic exchange to acquire ownership and a release store to unlock. It also disables local interrupts while holding a spinlock to avoid a same-CPU interrupt deadlock. The host program mirrors the acquire/release lock idea with GCC atomic built-ins and pthread worker threads. [3]')

    add_heading(doc, '5. C implementation')
    add_para(doc, 'The complete program is saved as src/race_demo.c. It creates a three-page list and two worker threads. The unlocked test uses a two-party pthread barrier as test instrumentation so both workers read P0 before either updates the head. The barrier fixes the interleaving for demonstration; it is not the repair.')
    add_para(doc, 'The host demo performs atomic loads and stores on the head pointer even in the unlocked case. This avoids relying on a C data race to illustrate the allocator bug. Each individual pointer access is atomic, but the whole pop is not. The spinlock is the single method that makes the combined operation exclusive.')
    add_heading(doc, 'Build and run', level=2)
    add_code_block(doc, 'cd "/mnt/c/Users/HP/Documents/OS record/OS CASE STUDY/case_study_14_rebuild"\nmake clean\nmake run', font_size=9)
    add_para(doc, 'Environment for the recorded run: WSL Ubuntu 24.04, GCC 13.3.0. The Makefile compiles src/race_demo.c with -std=c11 -Wall -Wextra -Wpedantic -O2 -pthread.')

    add_heading(doc, '6. Recorded result')
    output = (ROOT / 'evidence' / 'run_output.txt').read_text(encoding='utf-8')
    add_code_block(doc, output.strip(), font_size=8.1)
    add_caption(doc, 'Figure 1. Console output captured from the clean project run in evidence/run_output.txt.')
    add_table(doc, ['Run mode', 'Allocations', 'Pages exactly once', 'Observed state'], [
        ('Unlocked', 'CPU 0 = P0, CPU 1 = P0', '2 / 3', 'INCONSISTENT'),
        ('Spinlock', 'CPU 0 = P0, CPU 1 = P1', '3 / 3', 'CONSISTENT'),
    ], widths=[1.15, 2.25, 1.5, 1.7], font_size=8.7)
    add_caption(doc, 'Table 4. The actual run reproduces the duplicate page and then passes the invariant check with the spinlock.')
    add_para(doc, 'The demonstration check reports PASS because the expected contrast occurred: the unlocked schedule returned one page twice, while the spinlock run accounted for all three pages exactly once across allocations and the remaining list.')

    add_heading(doc, '7. Conclusion and limits')
    add_para(doc, 'The experiment shows why a shared allocator needs mutual exclusion across the whole operation that updates its free-list head. Two stale reads can return the same page. With the spinlock held across the read and update, the second caller observes the new head and receives another page.')
    add_para(doc, 'This controlled host-side example demonstrates one harmful interleaving and its spinlock fix. It is not a kernel experiment: it does not boot xv6, pin threads to physical CPU cores, measure lock contention, or explore all schedules. The result supports the stated invariant for this scenario and should not be read as a claim about every possible xv6 run.')
    add_heading(doc, 'References')
    for ref in [
        '[1] Case Study 14 assignment brief, “Race Condition in XV6 Shared Data,” supplied with the project.',
        '[2] MIT PDOS xv6-riscv source, kernel/kalloc.c, local revision ae7cff64d1cd1153e98794d19c46235ead934cf2.',
        '[3] MIT PDOS xv6-riscv source, kernel/spinlock.c, local revision ae7cff64d1cd1153e98794d19c46235ead934cf2.',
    ]:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.18)
        p.paragraph_format.first_line_indent = Inches(-0.18)
        r = p.add_run(ref)
        set_run_font(r, size=9)

    doc.add_page_break()
    add_heading(doc, 'Appendix A. Complete C source')
    add_para(doc, 'The listing below is the same source that produced the recorded output. The runnable file is also included at src/race_demo.c.')
    add_code_block(doc, CODE, font_size=7.1)
    doc.save(path)

def build_script(path):
    doc = Document()
    setup_document(doc, 'Speaker Script')
    add_cover(doc, 'Slide-by-slide speaking notes for the rebuilt presentation')
    add_heading(doc, 'Presenter guide')
    add_para(doc, 'This script follows the nine-slide deck and keeps the focus on one shared structure and one fix: xv6’s physical-page free list and a spinlock around the complete pop operation. The C program is a user-space model, not a modified xv6 kernel.')
    add_table(doc, ['Slides', 'Presenter', 'Focus'], [
        ('1-2', 'Venkat', 'Case question, goal, selected structure'),
        ('3-4', 'G Ishan', 'Free-list invariant and race schedule'),
        ('5, 7', 'L Nithish Kumar Goud', 'Runnable C model and recorded output'),
        ('6, 8', 'Santhosh', 'Spinlock operation and comparison'),
        ('9', 'Venkat', 'Conclusion and scope limits'),
    ], widths=[1.0, 2.5, 3.1], font_size=8.8)
    add_caption(doc, 'Table 1. Speaking assignments for the nine-slide deck.')
    add_heading(doc, 'Accuracy notes', level=2)
    for text in [
        'The two-thread barrier forces a specific interleaving in the host demonstration.',
        'Atomic pointer loads/stores avoid a C data race but do not make the whole free-list pop exclusive.',
        'The spinlock run is the corrected case. The program does not boot xv6 or modify kernel/kalloc.c.',
        'The output is from the recorded run in evidence/run_output.txt.',
    ]:
        add_bullet(doc, text)
    doc.add_page_break()
    slides = [
        ('Slide 1 | Case Study 14: Race Condition in xv6 Shared Data', 'Venkat', 'Good morning. We are presenting Case Study 14 on race conditions in xv6 shared data. Our focus is the physical-page free list. We will show how two concurrent allocations can act on the same old head, then run a small C model that reproduces that outcome and applies a spinlock fix.'),
        ('Slide 2 | Assignment and selected structure', 'Venkat', 'The assignment asks us to identify shared kernel data, study its critical section and lock, and compare behavior with and without synchronization. We chose the physical-memory free list, kmem.freelist. Our check is simple: a page must appear exactly once either in the free list or as an allocation.'),
        ('Slide 3 | The xv6 free-list invariant', 'G Ishan', 'The free list is a linked list of available physical pages. kalloc removes its head and kfree adds a page back at the head. In xv6, both operations use kmem.lock around the pointer changes. That scope matters because the read and update depend on one another.'),
        ('Slide 4 | One harmful interleaving', 'G Ishan', 'The table shows a possible schedule. CPU 0 reads P0, then CPU 1 also reads P0 before either advances the head. Both then store P1 as the new head and return P0. The same physical page now has two owners. This is the schedule we force in our host program, not a trace captured from xv6 hardware.'),
        ('Slide 5 | C code that reproduces the race', 'L Nithish Kumar Goud', 'In the unlocked worker, each thread loads the free-list head and saves its next pointer. The barrier waits until both threads have read the old head. Then both publish P1 and both return P0. We use atomic pointer operations so this demonstration does not depend on undefined C data races. The atomic accesses still do not protect the full operation.'),
        ('Slide 6 | Spinlock fix', 'Santhosh', 'The corrected worker acquires one spinlock before reading the head. It advances the head while still holding that lock, then releases it. The second worker enters afterward and sees P1. This preserves the page ownership invariant because the lock covers the whole read-and-update sequence.'),
        ('Slide 7 | Recorded run', 'L Nithish Kumar Goud', 'We built and ran the program with make run under WSL Ubuntu 24.04 using GCC 13.3.0. The unlocked case read P0 twice and returned P0 twice. The invariant audit found only two of three pages present exactly once. The spinlock case returned P0 and P1 and accounted for all three pages exactly once.'),
        ('Slide 8 | Comparison and interpretation', 'Santhosh', 'The two cases differ in whether the complete free-list pop has exclusive access. The unlocked run intentionally reproduces one harmful interleaving. The spinlock run preserves the invariant. This is a controlled demonstration, so it shows that the race can happen and how the lock prevents this schedule; it does not measure how frequently arbitrary races occur.'),
        ('Slide 9 | Conclusion and scope', 'Venkat', 'The main lesson is that mutual exclusion must cover every dependent read and write that preserves shared state. xv6 uses kmem.lock for its physical-page allocator. Our runnable C program mirrors that logic and makes the before-and-after behavior visible. It is a user-space teaching model, not a booted xv6 experiment. Thank you.'),
    ]
    for title, presenter, spoken in slides:
        add_heading(doc, title, level=1)
        p = doc.add_paragraph()
        r = p.add_run('Presenter: ' + presenter)
        set_run_font(r, size=9, color=TEAL, bold=True)
        p = doc.add_paragraph()
        r = p.add_run('Spoken script: ')
        set_run_font(r, size=10.5, bold=True)
        r = p.add_run(spoken)
        set_run_font(r, size=10.5)
        p.paragraph_format.keep_together = True
        if title.startswith('Slide 9'):
            add_para(doc, 'Source note: local xv6-riscv kernel/kalloc.c and kernel/spinlock.c at revision ae7cff64d1cd1153e98794d19c46235ead934cf2; recorded host run in evidence/run_output.txt.')
    doc.save(path)

OUT.mkdir(parents=True, exist_ok=True)
build_report(OUT / 'Case_Study_14_Race_Condition_Report.docx')
build_script(OUT / 'Case_Study_14_Speaker_Script.docx')
print('Wrote report and speaker script DOCX files.')
