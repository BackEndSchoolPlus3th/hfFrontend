import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import axios from 'axios';
import send from "../assets/images/send.png"
import memberList from "../assets/images/memberList.png"
import fileImage from "../assets/images/file.png"
import UserProfile from '../../../src/components/UserProfile';


interface ChatMessage {
    messageId?: number;
    nickname?: string;
    chatMessageContent: string;
    messageTimestamp: string;
    count?: number;
    email?: string;
}

interface PageInfo {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
}

interface ChatResponse {    // RsData 형식에 맞춰서 수정
    data: {
        content: ChatMessage[];
        page: PageInfo;
    }
}

interface MemberStatusResponse {
    resultCode: string;
    msg: string;
    data: MemberStatus[];
}

interface MemberStatus {
    nickname: string;
    userLoginStatus: string;
}

interface messageCountResponse {
    resultCode: string;
    msg: string;
    data: messageCount[];
}

interface messageCount {
    messageId: number;
    count: number;
}

interface FileUploadResponse {
    resultCode: string;
    msg: string;
    data: string;  // S3 URL
}

interface FileDeleteResponse {
    resultCode: string;
    msg: string;
}

const WEBSOCKET_URL = `${import.meta.env.VITE_CORE_WEBSOCKET_BASE_URL}/ws/chat`;
const request_URL = import.meta.env.VITE_CORE_API_BASE_URL;

const Chat: React.FC<{ memberId: number }> = ({ memberId }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const stompClientRef = useRef<Client | null>(null);
    const messagesListRef = useRef<HTMLDivElement>(null);
    const [currentUserNickname, setCurrentUserNickname] = useState<string>('');
    const [memberStatusList, setMemberStatusList] = useState<MemberStatus[]>([]);
    const { chatRoomId } = useParams();
    const navigate = useNavigate();
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [searchPage, setSearchPage] = useState(0);
    const [isSearchMode, setIsSearchMode] = useState(false);
    const [currentSearchKeyword, setCurrentSearchKeyword] = useState('');
    const [currentSearchNickname, setCurrentSearchNickname] = useState('');
    // 메시지 읽음 카운트 상태 추가
    const [messageReadCounts, setMessageReadCounts] = useState<{ [key: number]: number }>({});
    const [showScrollButton, setShowScrollButton] = useState(false);
    // 상태 추가
    const [showParticipants, setShowParticipants] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // 파일 삭제 함수
    const handleFileDelete = async (fileUrl: string) => {
        if (!chatRoomId) return;

        try {
            const response = await axios.delete<FileDeleteResponse>(
                `${request_URL}/api/v1/chatRooms/${chatRoomId}/files/delete`,
                {
                    params: { fileName: fileUrl },
                    withCredentials: true
                }
            );

            if (response.data.resultCode === "200") {
                // 성공 메시지 표시
                alert("파일이 성공적으로 삭제되었습니다.");

                // 필요한 경우 메시지 목록 업데이트
                setMessages(prevMessages =>
                    prevMessages.filter(msg => msg.chatMessageContent !== fileUrl)
                );
            }
        } catch (error: any) {
            if (error && 'response' in error && error.response?.data?.msg) {
                alert(error.response.data.msg);
            } else {
                console.error('파일 삭제 실패:', error);
                alert('파일 삭제에 실패했습니다.');
            }
        }
    };

    // 파일 업로드 함수
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !chatRoomId) return;

        // 파일 크기 검증 (5MB)
        const MAX_FILE_SIZE = 5 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            alert('파일 크기는 5MB를 초과할 수 없습니다.');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await axios.post<FileUploadResponse>(
                `${request_URL}/api/v1/chatRooms/${chatRoomId}/files/upload`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                    withCredentials: true
                }
            );

            if (response.data.resultCode === "200") {
                // 파일 URL을 포함한 메시지 전송
                const messageToSend = {
                    content: response.data.data, // S3 URL을 content로 전송
                    originalFileName: file.name  // 원본 파일명 추가
                };

                await axios.post(
                    `${request_URL}/api/v1/chatRooms/${chatRoomId}/messages`,
                    messageToSend,
                    { withCredentials: true }
                );

                setTimeout(() => {    // 맨 아래로 스크롤
                    scrollToBottom(true);
                }, 100)
            }
        } catch (error: any) {
            if (error && 'response' in error && error.response?.data?.msg) {
                setTimeout(() => {
                    alert(error.response.data.msg);
                }, 50)
            } else {
                console.error('파일 업로드 실패:', error);
            }
        }
    };

    // 메시지 스크롤 함수
    const scrollToBottom = (force: boolean = false) => {
        if (messagesListRef.current) {
            const element = messagesListRef.current;
            const isScrolledNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100;

            if (force || isScrolledNearBottom) {
                element.scrollTop = element.scrollHeight;
                setShowScrollButton(false);
            } else if (!isScrolledNearBottom) {
                setShowScrollButton(true);
            }
        }
    };

    // 스크롤 핸들러 함수
    const handleScroll = () => {
        if (messagesListRef.current) {
            const element = messagesListRef.current;
            const isScrolledNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100;

            if (isScrolledNearBottom) {
                setShowScrollButton(false);
            }
        }
    };

    // 메시지 필터링 함수
    const filterMessagesBySearch = (message: ChatMessage) => {
        if (!isSearchMode) return true;

        const contentMatch = message.chatMessageContent.toLowerCase()
            .includes(currentSearchKeyword.toLowerCase());
        const nicknameMatch = !currentSearchNickname ||
            (message.nickname?.toLowerCase() === currentSearchNickname.toLowerCase());

        return contentMatch && nicknameMatch;
    };

    // 채팅 메시지 읽음 카운트 가져오기
    const fetchMessageCount = async () => {
        try {
            const response = await axios.get<messageCountResponse>(
                request_URL + `/api/v1/chatRooms/${chatRoomId}/messages/count`,
                { withCredentials: true }
            );
            const counts = response.data.data.reduce((acc: { [key: number]: number }, curr) => {
                acc[curr.messageId] = curr.count;
                return acc;
            }, {});
            setMessageReadCounts(counts);
        } catch (error) {
            console.error('채팅 메시지 읽은 카운트 불러오기 실패', error);
        }
    };

    // 채팅방 입장 시 메시지 불러오기
    const fetchPreviousMessages = async (page: number) => {
        try {
            const response = await axios.get<ChatResponse>(
                request_URL + `/api/v1/chatRooms/${chatRoomId}/messages?page=${page}`,
                { withCredentials: true }  // 인증 정보 포함
            );

            if (page === 0) {
                setMessages(response.data.data.content);
                // 첫 로드시 가장 최신 메시지의 읽음 상태 업데이트
                if (response.data.data.content.length > 0) {
                    const latestMessage = response.data.data.content[0]; // 가장 최신 메시지
                    if (latestMessage.messageId) {  // id 필드 추가 필요
                        await updateMessageReadStatus(latestMessage.messageId);
                        await fetchMessageCount();
                    }
                }
                await updateMemberLoginStatus();    // 채팅방 멤버의 로그인 상태 가져오기
                setTimeout(() => scrollToBottom(true), 100);
            } else {
                setMessages(prev => [...prev, ...response.data.data.content]);
            }

            setHasMore(page < response.data.data.page.totalPages - 1);
        } catch (error) {
            console.error('메시지 조회 실패:', error);
        }
    };

    // 메시지 페이징
    const loadMoreMessages = () => {
        const nextPage = currentPage + 1;
        setCurrentPage(nextPage);
        fetchPreviousMessages(nextPage);
    };

    // 메시지 읽음 상태 업데이트 함수
    const updateMessageReadStatus = async (latestMessageId: number) => {
        try {
            const messageReadStatus = {
                messageId: latestMessageId
            };

            await axios.put(
                request_URL + `/api/v1/chatRooms/${chatRoomId}/messages/readStatus`,
                messageReadStatus,
                { withCredentials: true }  // 인증 정보 포함
            );
        } catch (error) {
            console.error('메시지 읽음 상태 업데이트 실패:', error);
        }
    };

    // 채팅방 멤버의 로그인 상태 가져오기
    const updateMemberLoginStatus = async () => {
        try {
            const response = await axios.get<MemberStatusResponse>(
                request_URL + `/api/v1/chatRooms/${chatRoomId}/members`,
                { withCredentials: true }
            );
            setMemberStatusList(response.data.data); // data 필드에서 멤버 상태 배열 추출
        } catch (error) {
            setTimeout(() => {
                alert("해당 채팅방의 멤버만 입장이 가능합니다.");
            }, 100)
            console.error('유저 로그인 상태 조회 실패:', error);
            await navigate('/chatroom');  // 채팅방 멤버가 아닐 경우, 모임 리스트 게시판으로 이동
        }
    }

    // 채팅방 멤버의 로그인 상태 오프라인으로 변경하기
    const updateLogout = async () => {
        try {
            await axios.patch(
                request_URL + `/api/v1/chatRooms/${chatRoomId}/members/logout`,
                {},
                { withCredentials: true }
            );
        } catch (error) {
            console.error('유저 로그아웃 상태 업데이트 실패:', error);
        };
    }

    // 채팅방 멤버의 로그인 상태 온라인으로 변경하기
    const updateLogin = async () => {
        try {
            await axios.patch(
                request_URL + `/api/v1/chatRooms/${chatRoomId}/members/login`,
                {},
                { withCredentials: true }
            );
        } catch (error) {
            console.error('유저 로그인 상태 업데이트 실패:', error);
        };
    }

    // 키워드 하이라이트 함수
    const highlightKeyword = (text: string, keyword: string) => {
        if (!keyword.trim()) return text;
        const parts = text.split(new RegExp(`(${keyword})`, 'gi'));
        return parts.map((part, i) =>
            part.toLowerCase() === keyword.toLowerCase() ?
                <span key={i} style={{ backgroundColor: '#ffeb3b', padding: '0 2px' }}>{part}</span>
                : part
        );
    };

    // 채팅 내용 검색
    const messageSearch = async (keyword: string, nickname: string, page: number = 0) => {
        try {
            // v2 엘라스틱, v1 쿼리dsl
            const response = await axios.get<ChatResponse>(
                `${request_URL}/api/v2/chatRooms/${chatRoomId}/messages/search`,
                {
                    params: {
                        keyword,
                        nickname,
                        // page
                    },
                    withCredentials: true
                }
            );

            if (response.data && response.data.data) {
                if (page === 0) {
                    setMessages(response.data.data.content);
                } else {
                    setMessages(prev => [...prev, ...response.data.data.content]);
                }
                setSearchKeyword(keyword);
                setHasMore(page < response.data.data.page.totalPages - 1);
                setIsSearchMode(true);
                setCurrentSearchKeyword(keyword);
                setCurrentSearchNickname(nickname);
                setSearchPage(page + 1);
            }
            setTimeout(() => {
                scrollToBottom(true);
            }, 100);
        } catch (error) {
            console.error('채팅 내용 검색 실패:', error);
        }
    };

    const loadMoreSearchResults = () => {
        if (isSearchMode) {
            messageSearch(currentSearchKeyword, currentSearchNickname, searchPage);
        }
    };

    useEffect(() => {
        const client = new Client({
            brokerURL: WEBSOCKET_URL,
            reconnectDelay: 5000,
            // // connectHeaders에 멤버ID와 채팅방ID 추가
            // connectHeaders: {
            //     memberId: memberId.toString(),
            //     chatRoomId: chatRoomId.toString()
            // },
            debug: (str) => {
                console.log('STOMP: ', str);
                console.log("web_url", import.meta.env)
            },
            onConnect: () => {
                console.log('STOMP 연결 성공');
                updateLogin();
                fetchPreviousMessages(0);
                setTimeout(() => {
                    fetchMessageCount();
                }, 100); // 0.1초 딜레이 (연속된 요청으로 인한 에러 방지)

                // 멤버 상태 변경 구독 추가
                client.subscribe(`/topic/members/${chatRoomId}`, () => {
                    setTimeout(() => {
                        updateMemberLoginStatus(); // 멤버 상태 변경 시 업데이트
                    }, 500); // 0.5초 딜레이 (연속된 요청으로 인한 에러 방지)
                });

                // 채팅 메시지 구독
                client.subscribe(`/topic/chat/${chatRoomId}`, (message) => {
                    if (message.body) {
                        const receivedData = JSON.parse(message.body);
                        switch (receivedData.type) {
                            case 'MESSAGE':
                                console.log("채팅 메시지 데이터:", receivedData.data); // 여기로 이동
                                const chatMessage: ChatMessage = {
                                    messageId: receivedData.data.id,
                                    nickname: receivedData.data.nickname,
                                    email: receivedData.data.email,  // 추가
                                    chatMessageContent: receivedData.data.chatMessageContent,
                                    messageTimestamp: receivedData.data.createDate
                                };

                                // 검색 모드일 때는 키워드가 포함된 메시지만 추가
                                if (!isSearchMode ||
                                    (chatMessage.chatMessageContent.toLowerCase().includes(currentSearchKeyword.toLowerCase()) &&
                                        (!currentSearchNickname || chatMessage.nickname?.toLowerCase() === currentSearchNickname.toLowerCase()))) {
                                    setMessages(prev => [chatMessage, ...prev]);
                                }

                                // 새 메시지 도착 시 스크롤 위치에 따라 알림 표시
                                if (messagesListRef.current) {
                                    const element = messagesListRef.current;
                                    const isScrolledNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100;

                                    if (!isScrolledNearBottom) {
                                        setShowScrollButton(true);
                                    } else {
                                        setTimeout(() => scrollToBottom(true), 50);
                                    }
                                }

                                // 새 메시지가 도착하면 읽음 상태 업데이트
                                if (receivedData.data.id) {
                                    updateMessageReadStatus(receivedData.data.id);
                                }
                                setTimeout(() => {
                                    fetchMessageCount();
                                }, 100); // 0.1초 딜레이 (연속된 요청으로 인한 에러 방지)
                                break;

                            case 'COUNT':
                                // COUNT 타입으로 받은 데이터를 메시지 읽음 수에 반영
                                const countMap = receivedData.data.reduce((acc: { [key: number]: number }, curr: messageCount) => {
                                    acc[curr.messageId] = curr.count;
                                    return acc;
                                }, {});
                                setMessageReadCounts(countMap);
                                break;

                            case 'DELETE':
                                setMessages(prevMessages =>
                                    prevMessages.filter(msg => msg.chatMessageContent !== receivedData.data)
                                );
                                break;
                        }
                    }

                });
            },
            onDisconnect: () => {
                updateLogout();
                console.log('STOMP 연결 종료');
            },
        });

        client.activate();
        stompClientRef.current = client;

        // 컴포넌트 언마운트 시 정리
        return () => {
            if (stompClientRef.current) {
                console.log('WebSocket 연결 정리 중...');
                stompClientRef.current.deactivate();
                stompClientRef.current = null;
            }
        };
    }, [chatRoomId, memberId]);

    // 스크롤 이벤트 리스너 추가
    useEffect(() => {
        const messagesList = messagesListRef.current;
        if (messagesList) {
            messagesList.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (messagesList) {
                messagesList.removeEventListener('scroll', handleScroll);
            }
        };
    }, []);

    // 메시지 전송
    const sendMessage = async () => {
        if (!messageInput.trim() || !stompClientRef.current) return;

        const messageToSend = {
            content: messageInput,
        };

        try {
            // stompClientRef.current.publish({
            //     destination: `/app/chat/${chatRoomId}`,
            //     body: JSON.stringify(messageToSend),
            // });

            await axios.post(
                request_URL + `/api/v1/chatRooms/${chatRoomId}/messages`,
                messageToSend,
                { withCredentials: true }  // 인증 정보 포함
            );

            setMessageInput('');
            scrollToBottom(true);
        } catch (error: any) {
            if (error.response?.status === 403) {        // 403코드는 error로 잡혀서 조건문 실행 안됨
                setTimeout(() => {
                    alert("해당 채팅방의 멤버만 채팅이 가능합니다.");
                }, 100)
                await navigate('/chatroom');  // 채팅방 멤버가 아닐 경우, 모임 리스트 게시판으로 이동
            }

            console.error('메시지 전송 실패:', error);
        }
    };


    const formatMessageTime = (timestamp: string) => {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            console.error('Invalid timestamp:', timestamp);
            return '';
        }

        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? '오후' : '오전';
        const formattedHours = hours % 12 || 12;
        const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;

        return `${ampm} ${formattedHours}:${formattedMinutes}`;
    };


    // 컴포넌트 마운트 시 데이터 가져오기
    useEffect(() => {
        // updateMemberLoginStatus();
    }, [chatRoomId]);  // chatRoomId가 바뀔 때마다 데이터 업데이트

    // 페이지 이동/브라우저 종료 시
    useEffect(() => {
        const handleBeforeUnload = () => {
            // WebSocket 연결 종료
            if (stompClientRef.current) {
                stompClientRef.current.deactivate();
                stompClientRef.current = null;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const userInfo = localStorage.getItem('userInfo');
                if (userInfo) {
                    const { data } = JSON.parse(userInfo);
                    setCurrentUserNickname(data.nickname);
                }
            } catch (error) {
                console.error('사용자 정보 로드 실패:', error);
            }
        };
        fetchUserInfo();
    }, []);

    // 채팅 검색 컴포넌트
    const ChatSearch = ({ onSearch }: { onSearch: (keyword: string, nickname: string) => void }) => {
        const [keyword, setKeyword] = useState("");

        // 검색 처리 함수 수정
        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();

            // '홍길동', 커피 형식의 패턴 매칭
            const nicknameContentPattern = /^['"]([^'"]+)['"],\s*(.+)$/;
            const match = keyword.match(nicknameContentPattern);

            let searchKeyword = keyword;
            let searchNickname = "";

            if (match) {
                // 매칭된 경우 닉네임과 검색어 분리
                searchNickname = match[1];    // 따옴표 안의 닉네임
                searchKeyword = match[2];     // 쉼표 뒤의 검색어
            } else {
                // 기존 'nickname:홍길동' 형식 처리
                const nicknameMatch = keyword.match(/'([^']+)'/);
                if (nicknameMatch) {
                    searchNickname = nicknameMatch[1];
                    searchKeyword = keyword.replace(/'.+?'/, '').trim();
                }
            }

            onSearch(searchKeyword, searchNickname);
        };

        const handleReset = async () => {
            // 검색 상태 초기화
            setIsSearchMode(false);
            setSearchPage(0);
            setCurrentSearchKeyword('');
            setCurrentSearchNickname('');
            setSearchKeyword('');
            setKeyword("");

            try {
                // 메시지 목록 초기화
                setMessages([]);
                // 페이지 초기화
                setCurrentPage(0);
                // hasMore 초기화
                setHasMore(true);

                // 전체 메시지 다시 로드
                await fetchPreviousMessages(0);

                // 스크롤 최하단으로 이동
                scrollToBottom(true);

            } catch (error) {
                console.error('메시지 초기화 실패:', error);
            }
        };

        return (
            <div className="p-4 border-b border-gray-200">
                <form onSubmit={handleSubmit} className="space-y-2">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="검색어 입력 (닉네임 검색: '홍길동', 검색어)"
                            className="flex-1 h-10 px-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                        />
                        <button
                            type="submit"
                            className="h-10 px-4 bg-primary text-white rounded-lg hover:bg-opacity-90"
                        >
                            검색
                        </button>
                        <button
                            type="button"
                            onClick={handleReset}
                            className="h-10 px-4 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                        >
                            초기화
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowParticipants(prev => !prev)}
                            className="h-10 px-4 text-gray-600 rounded-lg flex items-center gap-2"
                            style={{
                                backgroundColor: showParticipants ? '#F26A2E' : 'transparent',
                                color: showParticipants ? 'white' : '#F26A2E',
                            }}
                        >
                            <span className="transition-colors duration-300" style={{ display: 'inline-block' }}>
                                <img
                                    src={memberList}
                                    alt="멤버리스트"
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        filter: showParticipants ? 'brightness(0) invert(1)' : 'none', // 아이콘 색을 흰색으로
                                    }}
                                />
                            </span>
                        </button>
                    </div>
                </form>
            </div>
        );
    };

    // 메인 컨테이너
    return (
        <div className="messages-container flex">
            {/* 채팅 영역 */}
            <div className="flex-1"> {/* flex-1로 남은 공간 채움 */}
                <ChatSearch onSearch={(keyword, nickname) => messageSearch(keyword, nickname, 0)} />
                <div
                    className="messages-list relative flex flex-col"
                    ref={messagesListRef}
                    style={{
                        height: "400px",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        padding: "20px"
                    }}
                >
                    {/* 이전 메시지 더보기 버튼*/}
                    {!isSearchMode && hasMore && (
                        <button
                            onClick={loadMoreMessages}
                            className="w-full p-2 text-primary hover:bg-gray-50 mb-4"
                        >
                            이전 메시지 더보기
                        </button>
                    )}

                    {/* 기존 메시지 목록 렌더링 */}
                    {isSearchMode && hasMore && (
                        <button onClick={loadMoreSearchResults} className="w-full p-2 text-primary hover:bg-gray-50">
                            이전 메시지 더보기
                        </button>
                    )}

                    {/* 메시지 목록 */}
                    <div className="flex-grow flex flex-col justify-end" style={{ flexGrow: 1 }}>
                        {messages.slice().reverse().filter(filterMessagesBySearch).map((msg, index, array) => {
                            const isMyMessage = msg.nickname === currentUserNickname;
                            const readCount = msg.messageId ? messageReadCounts[msg.messageId] || 0 : 0;
                            // 이전 메시지와 닉네임이 다르면 닉네임 표시
                            const prevMessage = array[index - 1];
                            const showNickname = !isMyMessage && (!prevMessage || prevMessage.nickname !== msg.nickname);

                            return (
                                <div key={index} style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: isMyMessage ? 'flex-end' : 'flex-start',
                                    margin: '8px 0'
                                }}>
                                    {/* 닉네임 표시 (자신의 메시지가 아닐 때만) */}
                                    {showNickname && (
                                        <span style={{
                                            fontSize: '0.8rem',
                                            color: '#666',
                                            marginBottom: '4px',
                                            marginLeft: '8px',
                                            display: 'flex',  // 추가
                                            alignItems: 'center',  // 추가
                                            gap: '4px'  // 추가
                                        }}>
                                            {msg.nickname}
                                            {msg.email && <UserProfile email={msg.email} />}
                                        </span>
                                    )}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: isMyMessage ? 'row-reverse' : 'row',
                                        alignItems: 'flex-end',
                                        gap: '8px'
                                    }}>
                                        <div style={{
                                            ...(msg.chatMessageContent.includes('https://hf-chat.s3.ap-northeast-2.amazonaws.com')
                                                ? {
                                                    // 이미지 메시지일 때의 스타일
                                                    padding: '8px 40px 8px 0',
                                                    background: 'transparent',
                                                    maxWidth: '70%',
                                                    wordBreak: 'break-word'
                                                }
                                                : {
                                                    // 일반 텍스트 메시지일 때 기존 말풍선 스타일 유지
                                                    background: isMyMessage ? '#F26A2E' : '#e9ecef',
                                                    color: isMyMessage ? 'white' : 'black',
                                                    padding: '8px 12px',
                                                    borderRadius: isMyMessage ? '15px 15px 0 15px' : '15px 15px 15px 0',
                                                }),
                                            maxWidth: '70%',
                                            wordBreak: 'break-word'
                                        }}>
                                            {msg.chatMessageContent.includes('https://hf-chat.s3.ap-northeast-2.amazonaws.com') ? (
                                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                                    <img
                                                        src={msg.chatMessageContent}
                                                        alt="채팅 이미지"
                                                        style={{
                                                            maxWidth: '200px',
                                                            maxHeight: '200px',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer'
                                                        }}
                                                        onClick={() => window.open(msg.chatMessageContent, '_blank')}
                                                    />
                                                    {isMyMessage && (
                                                        <button
                                                            onClick={() => handleFileDelete(msg.chatMessageContent)}
                                                            style={{
                                                                position: 'absolute',
                                                                top: '5px',
                                                                right: '5px',
                                                                padding: '4px 8px',
                                                                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '12px',
                                                            }}
                                                        >
                                                            삭제
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                highlightKeyword(msg.chatMessageContent, searchKeyword)
                                            )}
                                        </div>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: '#6c757d',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '2px',
                                            alignItems: isMyMessage ? 'flex-end' : 'flex-start'
                                        }}>
                                            {readCount > 0 && (
                                                <span style={{ color: '#F26A2E', fontSize: '0.7rem' }}>
                                                    {readCount}
                                                </span>
                                            )}
                                            <span>{formatMessageTime(msg.messageTimestamp)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 새 메시지 알림 및 스크롤 버튼 */}
                    {showScrollButton && (
                        <div
                            className="sticky bottom-4 left-0 right-0 flex justify-center"
                            style={{
                                position: 'sticky',
                                bottom: '20px',
                                width: '100%',
                                zIndex: 10
                            }}
                        >
                            <button
                                onClick={() => scrollToBottom(true)}
                                className="bg-primary text-white px-4 py-2 rounded-full shadow-lg hover:bg-opacity-90 flex items-center gap-2"
                            >
                                새 메시지
                            </button>
                        </div>
                    )}
                </div>

                {/* 메시지 입력창 */}
                <div className="message-input" style={{
                    display: 'flex',
                    gap: '8px',
                    padding: '10px',
                    borderTop: '1px solid #ddd'
                }}>
                    <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="메시지를 입력하세요..."
                        maxLength={250}
                        style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            outline: 'none' // 기본 포커스 테두리 제거
                        }}
                        onFocus={(e) => e.target.style.border = '1px solid #F26A2E'} // 포커스 시 테두리 색상
                        onBlur={(e) => e.target.style.border = '1px solid #ddd'} // 포커스 해제 시 원래 색상
                    />
                    <button
                        onClick={sendMessage}
                        style={{
                            padding: '8px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <img
                            src={send}
                            alt="채팅전송"
                            style={{
                                width: '24px',
                                height: '24px',
                                filter: messageInput.trim()
                                    ? 'invert(47%) sepia(82%) saturate(2604%) hue-rotate(337deg) brightness(97%) contrast(92%)'
                                    : 'opacity(0.5)'
                            }}
                        />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        accept="image/*"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            paddingBottom: '1px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                        <img
                            src={fileImage}
                            alt="파일전송"
                            style={{
                                width: '24px',
                                height: '24px',
                                filter: 'opacity(0.5)'
                            }}
                        />
                    </button>
                </div>
            </div>

            {/* 참여자 목록 섹션 */}
            {showParticipants && (
                <div className="w-64 border-l border-gray-200 p-4 bg-white">
                    <h3 className="text-lg font-semibold mb-4">참여자 목록</h3>

                    {/* 온라인 멤버 */}
                    <div className="space-y-2 mb-4">
                        {memberStatusList
                            .filter(status => status.userLoginStatus === "LOGIN")
                            .map((status, index) => (
                                <div key={index} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg">
                                    <div
                                        className="w-2 h-2 rounded-full animate-pulse"
                                        style={{
                                            backgroundColor: '#22c55e',
                                            boxShadow: '0 0 4px #22c55e',
                                            minWidth: '8px',
                                            minHeight: '8px'
                                        }}
                                    />
                                    <span className="text-sm text-gray-700">{status.nickname}</span>
                                </div>
                            ))}
                    </div>

                    {/* 오프라인 멤버 */}
                    <div className="space-y-2">
                        {memberStatusList
                            .filter(status => status.userLoginStatus !== "LOGIN")
                            .map((status, index) => (
                                <div key={index} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg">
                                    <div
                                        className="w-2 h-2 rounded-full"
                                        style={{
                                            backgroundColor: '#9ca3af',
                                            boxShadow: '0 0 4px #9ca3af',
                                            minWidth: '8px',
                                            minHeight: '8px'
                                        }}
                                    />
                                    <span className="text-sm text-gray-500">{status.nickname}</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chat;