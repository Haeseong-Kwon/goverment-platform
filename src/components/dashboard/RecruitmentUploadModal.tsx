import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Trash2 } from "lucide-react";
import { TeamBuildingPost } from "@/types";
import { SemesterOption } from "@/lib/semester";

interface RecruitmentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newPost: TeamBuildingPost) => void;
  activeSemester: SemesterOption;
}

export function RecruitmentUploadModal({ isOpen, onClose, onSubmit, activeSemester }: RecruitmentUploadModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [projectPhase, setProjectPhase] = useState<'IDEA' | 'MVP' | 'SCALE'>('IDEA');
  const [courseBadge, setCourseBadge] = useState<'CAPSTONE_1' | 'CAPSTONE_2'>('CAPSTONE_1');
  const [recruitingRoles, setRecruitingRoles] = useState<{ role: string; current: number; total: number }[]>([{ role: "", current: 0, total: 1 }]);
  const [techStacks, setTechStacks] = useState<string[]>([]);
  const [stackInput, setStackInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      document.body.style.overflow = "hidden";
      // Defer showing modal to next frame for smooth open
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const t = setTimeout(() => {
        document.body.style.overflow = "unset";
        setIsRendered(false);
      }, 220); // slightly after animation ends
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!mounted || !isRendered) return null;

  const handleAddRole = () => setRecruitingRoles([...recruitingRoles, { role: "", current: 0, total: 1 }]);
  const handleRemoveRole = (index: number) => setRecruitingRoles(recruitingRoles.filter((_, i) => i !== index));
  const handleRoleChange = (index: number, field: keyof typeof recruitingRoles[0], value: string | number) => {
    const newRoles = [...recruitingRoles];
    (newRoles[index] as any)[field] = value;
    setRecruitingRoles(newRoles);
  };

  const handleAddStack = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && stackInput.trim()) {
      e.preventDefault();
      if (!techStacks.includes(stackInput.trim())) setTechStacks([...techStacks, stackInput.trim()]);
      setStackInput("");
    }
  };

  const removeStack = (stack: string) => setTechStacks(techStacks.filter(s => s !== stack));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newPost: TeamBuildingPost = {
      id: `post_${Date.now()}`,
      title, content,
      authorId: "current_user",
      authorName: "김철수",
      tags: techStacks,
      projectPhase, recruitingRoles, courseBadge,
      createdAt: new Date().toLocaleDateString('ko-KR'),
    };
    onSubmit(newPost);
    setTitle(""); setContent(""); setProjectPhase('IDEA'); setCourseBadge('CAPSTONE_1');
    setRecruitingRoles([{ role: "", current: 0, total: 1 }]); setTechStacks([]);
  };

  const overlayStyle: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transition: 'opacity 0.2s ease',
  };
  const panelStyle: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.98)',
    transition: 'opacity 0.2s ease, transform 0.2s ease',
    willChange: 'transform, opacity',
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Pure dark overlay — NO backdrop-blur on the overlay */}
      <div className="absolute inset-0 bg-slate-950/70" style={overlayStyle} onClick={onClose} />

      {/* Modal panel — GPU-promoted layer, solid opaque colors, zero blur */}
      <div
        className="relative bg-white dark:bg-slate-900 w-full max-w-6xl max-h-full h-full md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl"
        style={panelStyle}
      >
        {/* 헤더 */}
        <div className="flex-none bg-white dark:bg-slate-900 px-8 py-6 md:px-12 md:py-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-6 bg-primary dark:bg-blue-500 rounded-full"></div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight uppercase">팀원 모집글 올리기</h2>
            </div>
            <p className="text-xs font-bold text-slate-400 tracking-widest uppercase">
              {activeSemester.label} / {activeSemester.courseLabel}
            </p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 rounded-2xl" style={{ transition: 'color 0.15s, background-color 0.15s' }}>
            <X size={24} />
          </button>
        </div>

        {/* 메인 폼 영역 */}
        <div className="flex-1 overflow-y-auto px-8 py-10 md:px-12 md:py-12" style={{ overscrollBehavior: 'contain' }}>
          <form id="recruitment-upload-form" onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-16">

            {/* 01. 프로젝트 개요 */}
            <section>
              <div className="flex items-center gap-4 mb-8">
                <span className="text-4xl font-black text-slate-100 dark:text-slate-800 select-none">01</span>
                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-50">프로젝트 개요</h3>
                <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3 md:col-span-2">
                  <label className="text-[11px] font-black text-primary dark:text-blue-400 uppercase tracking-widest ml-1">공고 제목 <span className="text-red-500">*</span></label>
                  <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-50 outline-none font-bold" style={{ transition: 'border-color 0.15s, box-shadow 0.15s' }} placeholder="함께 세상을 바꿀 팀원을 찾습니다" />
                </div>
                <div className="space-y-3 md:col-span-2">
                  <label className="text-[11px] font-black text-primary dark:text-blue-400 uppercase tracking-widest ml-1">상세 설명 <span className="text-red-500">*</span></label>
                  <textarea required rows={5} value={content} onChange={e => setContent(e.target.value)} className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-50 outline-none font-bold resize-none" style={{ transition: 'border-color 0.15s' }} placeholder="아이디어나 현재 진행 상황, 찾는 팀원상 등을 적어주세요" />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-primary dark:text-blue-400 uppercase tracking-widest ml-1">과목 구분</label>
                  <div className="flex gap-4">
                    <button type="button" onClick={() => setCourseBadge("CAPSTONE_1")} className={`flex-1 py-4 rounded-xl font-bold text-sm ${courseBadge === "CAPSTONE_1" ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`} style={{ transition: 'background-color 0.15s, color 0.15s' }}>캡스톤 1</button>
                    <button type="button" onClick={() => setCourseBadge("CAPSTONE_2")} className={`flex-1 py-4 rounded-xl font-bold text-sm ${courseBadge === "CAPSTONE_2" ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`} style={{ transition: 'background-color 0.15s, color 0.15s' }}>캡스톤 2</button>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-primary dark:text-blue-400 uppercase tracking-widest ml-1">진행 단계</label>
                  <div className="flex gap-4">
                    {(['IDEA', 'MVP', 'SCALE'] as const).map((phase) => (
                      <button key={phase} type="button" onClick={() => setProjectPhase(phase)} className={`flex-1 py-4 rounded-xl font-bold text-[11px] ${projectPhase === phase ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`} style={{ transition: 'background-color 0.15s, color 0.15s' }}>{phase}</button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 02. 모집 포지션 */}
            <section>
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <span className="text-4xl font-black text-slate-100 dark:text-slate-800 select-none">02</span>
                  <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-50">모집 포지션</h3>
                </div>
                <button type="button" onClick={handleAddRole} className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-black uppercase tracking-[0.2em] active:scale-95" style={{ transition: 'background-color 0.15s, color 0.15s, transform 0.1s' }}>
                  <Plus size={16} /> 포지션 추가
                </button>
              </div>
              <div className="space-y-6">
                {recruitingRoles.map((role, index) => (
                  <div key={index} className="relative bg-slate-50 dark:bg-slate-800/30 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-6 items-end">
                      <div className="sm:col-span-3 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">역할 (예: 프론트엔드, 기획자)</label>
                        <input required type="text" value={role.role} onChange={e => handleRoleChange(index, "role", e.target.value)} className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-50 outline-none" placeholder="역할 입력" />
                      </div>
                      <div className="sm:col-span-1 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">현재 인원</label>
                        <input type="number" min="0" value={role.current} onChange={e => handleRoleChange(index, "current", parseInt(e.target.value))} className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-50 outline-none" />
                      </div>
                      <div className="sm:col-span-1 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">전체 인원</label>
                        <input type="number" min="1" value={role.total} onChange={e => handleRoleChange(index, "total", parseInt(e.target.value))} className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-50 outline-none" />
                      </div>
                      <div className="sm:col-span-1 flex justify-center pb-1">
                        <button type="button" onClick={() => handleRemoveRole(index)} className="p-3 text-slate-300 hover:text-red-500 rounded-xl" style={{ transition: 'color 0.15s' }}>
                          <Trash2 size={24} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 03. 기술 스택 */}
            <section>
              <div className="flex items-center gap-4 mb-8">
                <span className="text-4xl font-black text-slate-100 dark:text-slate-800 select-none">03</span>
                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-50">필요 기술 스택</h3>
                <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
              </div>
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">기술 태그 (Enter를 눌러 추가)</label>
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {techStacks.map((stack) => (
                      <span key={stack} className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-black text-primary dark:text-blue-400 uppercase tracking-widest">
                        {stack}
                        <button type="button" onClick={() => removeStack(stack)} className="text-slate-400 hover:text-red-500" style={{ transition: 'color 0.15s' }}>
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input type="text" value={stackInput} onChange={e => setStackInput(e.target.value)} onKeyDown={handleAddStack} className="w-full bg-transparent border-none outline-none font-bold text-sm text-slate-900 dark:text-slate-50" placeholder="태그를 입력하세요 (예: Next.js, Figma, AI...)" />
                </div>
              </div>
            </section>
          </form>
        </div>

        {/* 푸터 */}
        <div className="flex-none bg-white dark:bg-slate-900 px-8 py-6 md:px-12 md:py-8 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-end items-center gap-4">
          <button type="button" onClick={onClose} className="w-full sm:w-auto px-10 py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" style={{ transition: 'background-color 0.15s' }}>
            취소하기
          </button>
          <button form="recruitment-upload-form" type="submit" className="w-full sm:w-auto px-12 py-5 rounded-2xl font-black text-[12px] uppercase tracking-[0.25em] bg-primary dark:bg-blue-500 text-white hover:opacity-90 active:scale-95 shadow-lg" style={{ transition: 'opacity 0.15s, transform 0.1s' }}>
            공고 올리기
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
