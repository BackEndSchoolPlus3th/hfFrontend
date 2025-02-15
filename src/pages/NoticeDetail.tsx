import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface NoticeDetail {
    id: number;
    title: string;
    content: string;
    createDate: string;
    boardCommentDtos: Comment[];
}

interface Comment {
    id: number;
    content: string;
    createDate: string;
    authorId: number;
    authorNickname: string;
    modifyDate: string | null;
}

interface ApiResponse {
    resultCode: string;
    data: NoticeDetail;
}

// 응답 타입 정의
interface CommentResponse {
    resultCode: string;
    msg: string;
    data: Comment;
}

interface NoticeDetailProps {
    isLoggedIn: boolean;
    setIsLoggedIn: (isLoggedIn: boolean) => void;
    isAlertOpen: boolean;
    setIsAlertOpen: (isOpen: boolean) => void;
}

const NoticeDetail = ({ isLoggedIn, setIsLoggedIn, isAlertOpen, setIsAlertOpen }: NoticeDetailProps) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [notice, setNotice] = useState<NoticeDetail | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editContent, setEditContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 게시글 상세 정보 조회
    useEffect(() => {
        const fetchNoticeDetail = async () => {
            try {
                const response = await axios.get<ApiResponse>(
                    `${import.meta.env.VITE_CORE_API_BASE_URL}/api/v1/boards/${id}`,
                    {
                        withCredentials: true,
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    }
                );

                // 응답 데이터 확인을 위한 로그
                console.log('게시글 상세 정보:', response.data);
                console.log('게시글 데이터:', response.data.data);
                console.log('댓글 목록:', response.data.data.boardCommentDtos);

                if (response.data.resultCode === "200") {
                    setNotice(response.data.data);
                    // 댓글 목록이 undefined인 경우 빈 배열로 설정
                    const commentList = response.data.data.boardCommentDtos;
                    console.log('설정할 댓글 목록:', commentList);
                    setComments(commentList || []);
                }
            } catch (err) {
                console.error('Error fetching notice detail:', err);
                setError('공지사항을 불러오는데 실패했습니다.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchNoticeDetail();
    }, [id]);

    // 댓글 작성
    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            const response = await axios.post<CommentResponse>(
                `${import.meta.env.VITE_CORE_API_BASE_URL}/api/v1/boardComment/create/${id}`,
                { content: newComment },
                {
                    withCredentials: true,
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (response.data.resultCode === "200") {
                // 현재 로그인한 사용자의 정보를 가져옴
                const currentUser = JSON.parse(localStorage.getItem('userInfo')!).data;
                
                // 새 댓글에 작성자 ID와 닉네임 포함
                const newCommentData = {
                    ...response.data.data,
                    authorId: currentUser.id,
                    authorNickname: currentUser.nickname
                };
                
                setComments(prevComments => [...prevComments, newCommentData]);
                setNewComment('');
            }
        } catch (error: any) {
            console.error('댓글 작성 실패:', error.response?.data || error);
            alert(error.response?.data?.msg || '댓글 작성에 실패했습니다.');
        }
    };

    // 댓글 수정
    const handleCommentEdit = async (commentId: number) => {
        if (!editContent.trim()) return;

        try {
            const response = await axios.patch<CommentResponse>(
                `${import.meta.env.VITE_CORE_API_BASE_URL}/api/v1/boardComment/modify/${commentId}`,
                { content: editContent },
                {
                    withCredentials: true,
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (response.data.resultCode === "200") {
                // 기존 댓글의 모든 정보를 유지하면서 content와 modifyDate만 업데이트
                setComments(comments.map(comment =>
                    comment.id === commentId 
                        ? { 
                            ...comment,
                            content: editContent,
                            modifyDate: new Date().toISOString()
                        }
                        : comment
                ));
                setEditingCommentId(null);
                setEditContent('');
            }
        } catch (error) {
            console.error('댓글 수정 실패:', error);
            alert('댓글 수정에 실패했습니다.');
        }
    };

    // 댓글 삭제
    const handleCommentDelete = async (commentId: number) => {
        if (!window.confirm('댓글을 삭제하시겠습니까?')) return;

        try {
            const response = await axios.delete<CommentResponse>(
                `${import.meta.env.VITE_CORE_API_BASE_URL}/api/v1/boardComment/delete/${commentId}`,
                {
                    withCredentials: true,
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (response.data.resultCode === "200") {
                // 삭제된 댓글을 상태에서 즉시 제거
                setComments(prevComments => prevComments.filter(comment => comment.id !== commentId));
                alert('댓글이 삭제되었습니다.');
            }
        } catch (error) {
            console.error('댓글 삭제 실패:', error);
            alert('댓글 삭제에 실패했습니다.');
        }
    };

    if (error) return <div className="p-4 text-center text-red-500">{error}</div>;
    if (isLoading) return <div className="p-4 text-center">Loading...</div>;

    return (
        <>
            <Header
                isLoggedIn={isLoggedIn}
                setIsLoggedIn={setIsLoggedIn}
                isAlertOpen={isAlertOpen}
                setIsAlertOpen={setIsAlertOpen}
                userInfo={localStorage.getItem('userInfo') ? JSON.parse(localStorage.getItem('userInfo')!) : null}
            />
            <main className="flex-1 mt-[72px] mb-16">
                <div className="max-w-[600px] lg:max-w-screen-lg mx-auto">
                    <div className="bg-white rounded-lg shadow-sm">
                        <div className="p-6">
                            <div className="mb-8">
                                <button
                                    onClick={() => navigate('/notice')}
                                    className="text-gray-500 hover:text-primary mb-4 flex items-center"
                                >
                                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    목록으로
                                </button>
                                <h1 className="text-2xl font-bold mb-2">{notice?.title}</h1>
                                <p className="text-sm text-gray-500">
                                    {notice?.createDate && new Date(notice.createDate).toISOString().slice(0, 10).replace(/-/g, ".")}
                                </p>
                            </div>
                            <div className="prose max-w-none mb-8">
                                {notice?.content.split('\n').map((line, index) => (
                                    <p key={index} className="mb-4">{line}</p>
                                ))}
                            </div>

                            {/* 댓글 섹션 */}
                            <div className="mt-8 border-t border-gray-200 pt-8">
                                <h3 className="text-lg font-bold mb-4">댓글</h3>

                                {/* 댓글 작성 폼 */}
                                {isLoggedIn && (
                                    <form onSubmit={handleCommentSubmit} className="mb-6">
                                        <textarea
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            placeholder="댓글을 작성해주세요"
                                            className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary resize-none"
                                            rows={3}
                                        />
                                        <div className="flex justify-end mt-2">
                                            <button
                                                type="submit"
                                                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90"
                                            >
                                                댓글 작성
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {/* 댓글 목록 */}
                                <div className="space-y-4">
                                    {comments.map(comment => (
                                        <div key={comment.id} className="border-b border-gray-100 py-4">
                                            {editingCommentId === comment.id ? (
                                                <div>
                                                    <textarea
                                                        value={editContent}
                                                        onChange={(e) => setEditContent(e.target.value)}
                                                        className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary resize-none"
                                                        rows={3}
                                                    />
                                                    <div className="flex justify-end gap-2 mt-2">
                                                        <button
                                                            onClick={() => handleCommentEdit(comment.id)}
                                                            className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-opacity-90"
                                                        >
                                                            저장
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEditingCommentId(null);
                                                                setEditContent('');
                                                            }}
                                                            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-opacity-90"
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-700">{comment.authorNickname}</span>
                                                            <span className="text-sm text-gray-500">
                                                                {new Date(comment.createDate).toISOString().slice(0, 10).replace(/-/g, ".")}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <p className="text-gray-700">{comment.content}</p>
                                                    {isLoggedIn && localStorage.getItem('userInfo') && 
                                                        JSON.parse(localStorage.getItem('userInfo')!).data.id === comment.authorId && (
                                                        <div className="flex justify-end gap-2 mt-2">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingCommentId(comment.id);
                                                                    setEditContent(comment.content);
                                                                }}
                                                                className="text-sm text-gray-500 hover:text-primary"
                                                            >
                                                                수정
                                                            </button>
                                                            <button
                                                                onClick={() => handleCommentDelete(comment.id)}
                                                                className="text-sm text-red-500 hover:text-red-600"
                                                            >
                                                                삭제
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
};

export default NoticeDetail; 