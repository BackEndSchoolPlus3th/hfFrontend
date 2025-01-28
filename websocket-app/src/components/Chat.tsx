import React, { useState, useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import axios from 'axios';

interface ChatMessage {
    messageId?: number;
    nickname?: string;
    chatMessageContent: string;
    messageTimestamp: string;
}

interface PageInfo {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
}

interface ChatResponse {
    content: ChatMessage[];
    page: PageInfo;
}

const WEBSOCKET_URL = 'ws://localhost:8090/ws/chat';

const Chat: React.FC<{ chatRoomId: number; memberId: number }> = ({ chatRoomId, memberId }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const stompClientRef = useRef<Client | null>(null);
    const messagesListRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        if (messagesListRef.current) {
            messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
        }
    };

    const fetchPreviousMessages = async (page: number) => {
        try {
            const response = await axios.get<ChatResponse>(
                `http://localhost:8090/api/v1/chatRooms/${chatRoomId}/messages?page=${page}`
            );

            if (page === 0) {
                setMessages(response.data.content);
                // 첫 로드시 가장 최신 메시지의 읽음 상태 업데이트
                if (response.data.content.length > 0) {
                    const latestMessage = response.data.content[0]; // 가장 최신 메시지
                    if (latestMessage.messageId) {  // id 필드 추가 필요
                        updateMessageReadStatus(latestMessage.messageId);
                    }
                }
                setTimeout(() => scrollToBottom(), 100);
            } else {
                setMessages(prev => [...prev, ...response.data.content]);
            }

            setHasMore(page < response.data.page.totalPages - 1);
        } catch (error) {
            console.error('메시지 조회 실패:', error);
        }
    };

    const loadMoreMessages = () => {
        const nextPage = currentPage + 1;
        setCurrentPage(nextPage);
        fetchPreviousMessages(nextPage);
    };

    // 메시지 읽음 상태 업데이트 함수
    const updateMessageReadStatus = async (latestMessageId: number) => {
        try {
            const messageReadStatus = {
                memberId: memberId,
                messageId: latestMessageId
            };

            await axios.put(
                `http://localhost:8090/api/v1/chatRooms/${chatRoomId}/messages/readStatus`,
                messageReadStatus
            );
        } catch (error) {
            console.error('메시지 읽음 상태 업데이트 실패:', error);
        }
    };

    useEffect(() => {
        const client = new Client({
            brokerURL: WEBSOCKET_URL,
            reconnectDelay: 5000,
            debug: (str) => {
                console.log('STOMP: ', str);
            },
            onConnect: () => {
                console.log('STOMP 연결 성공');
                fetchPreviousMessages(0);

                client.subscribe(`/topic/chat/${chatRoomId}`, (message) => {
                    if (message.body) {
                        const receivedMessage = JSON.parse(message.body);
                        const chatMessage: ChatMessage = {
                            nickname: receivedMessage.nickname,
                            chatMessageContent: receivedMessage.chatMessageContent,
                            messageTimestamp: receivedMessage.createDate
                        };
                        setMessages(prev => [chatMessage, ...prev]);
                        
                        // 새 메시지가 도착하면 읽음 상태 업데이트
                        if (receivedMessage.id) {
                            updateMessageReadStatus(receivedMessage.id);
                        }
                    }
                });
            },
            onDisconnect: () => {
                console.log('STOMP 연결 종료');
            },
        });

        client.activate();
        stompClientRef.current = client;

        return () => {
            client.deactivate();
        };
    }, [chatRoomId]);

    const sendMessage = async () => {
        if (!messageInput.trim() || !stompClientRef.current) return;

        const messageToSend = {
            memberId,
            content: messageInput,
        };

        try {
            stompClientRef.current.publish({
                destination: `/app/chat/${chatRoomId}`,
                body: JSON.stringify(messageToSend),
            });

            await axios.post(
                `http://localhost:8090/api/v1/chatRooms/${chatRoomId}/messages`,
                messageToSend
            );

            setMessageInput('');
            scrollToBottom();
        } catch (error) {
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

    return (
        <div className="messages-container">
            <div
                className="messages-list"
                ref={messagesListRef}
                style={{
                    height: "400px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    padding: "20px"
                }}
            >
                {hasMore && (
                    <button
                        onClick={loadMoreMessages}
                        className="load-more-button"
                        style={{
                            margin: "10px auto",
                            padding: "5px 10px"
                        }}
                    >
                        이전 메시지 더보기
                    </button>
                )}
                <div style={{ flexGrow: 1 }}>
                    {messages.slice().reverse().map((msg, index) => (
                        <div key={index} className="message" style={{
                            display: 'flex',
                            flexDirection: 'column',
                            margin: '10px 0'
                        }}>
                            <div style={{
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'flex-end',
                                marginBottom: '4px'
                            }}>
                                <span style={{ 
                                    color: '#666',
                                    fontSize: '0.9em',
                                    fontWeight: 500
                                }}>
                                    {msg.nickname}
                                </span>
                            </div>
                            <div style={{
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'flex-end'
                            }}>
                                <div style={{
                                    background: '#f0f2f5',
                                    padding: '8px 12px',
                                    borderRadius: '12px 12px 12px 0',
                                    maxWidth: '70%',
                                    wordBreak: 'break-word',
                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                                }}>
                                    {msg.chatMessageContent || "내용 없음"}
                                </div>
                                <span style={{ 
                                    color: '#888', 
                                    fontSize: '0.8em',
                                    marginBottom: '4px'
                                }}>
                                    {formatMessageTime(msg.messageTimestamp)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
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
                        border: '1px solid #ddd'
                    }}
                />
                <button 
                    onClick={sendMessage}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    전송
                </button>
            </div>
        </div>
    );
};

export default Chat;