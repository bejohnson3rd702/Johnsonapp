import React, { useState, useContext, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Platform, StatusBar, Image, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeContext } from '../ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView, BlurTint } from 'expo-blur';
import { ResizeMode, Video } from 'expo-av';

// --- FIREBASE IMPORTS ---
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, storage, auth } from '../../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';

export default function FeedScreen() {
  const { isDark } = useContext(ThemeContext);
  const styles = getStyles(isDark);

  const [activeScope, setActiveScope] = useState('entire'); // 'entire' or 'household'
  const [newPostText, setNewPostText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{uri: string, type: 'image'|'video' | undefined} | null>(null);

  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  type Post = { id: string; author: string; authorId: string; text: string; time: string; scope: string; mediaUrl?: string; mediaType?: 'image'|'video'; likes: string[]; comments?: any[]; createdAt?: any };
  type FamilyEvent = { id: string; title: string; date: string; time: string; author: string; isEntireFamily: boolean; householdId: string; };

  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // LIVE FIRESTORE SYNC
  useEffect(() => {
    const q = query(collection(db, 'family_feed'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const livePosts = snapshot.docs.map(doc => {
        const data = doc.data();
        let timeString = 'Just now';
        if (data.createdAt) {
          const date = data.createdAt.toDate();
          timeString = date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });
        }
        
        return {
          id: doc.id,
          author: data.author || 'Family Member',
          authorId: data.authorId || '',
          text: data.text || '',
          time: timeString,
          scope: data.scope || 'entire',
          mediaUrl: data.mediaUrl,
          mediaType: data.mediaType,
          likes: data.likes || [],
          comments: data.comments || []
        } as Post;
      });
      setPosts(livePosts);
    });

    const qEvents = query(collection(db, 'events'), orderBy('createdAt', 'asc'));
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
       setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FamilyEvent)));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
       setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubscribe(); unsubEvents(); unsubUsers(); };
  }, []);

  const globalEvents = useMemo(() => {
     let list = [...events.filter(e => e.isEntireFamily)];
     const currentMonth = new Date().getMonth() + 1; // 1-12
     
     users.forEach(u => {
        if (u.birthday && typeof u.birthday === 'string') {
           const parts = u.birthday.split('/');
           if (parts.length >= 2) {
              const bMonth = parseInt(parts[0], 10);
              if (bMonth === currentMonth) {
                 list.push({
                    id: 'bday_' + u.id,
                    title: `${u.name}'s Birthday!`,
                    date: `${parts[0]}/${parts[1]}`, // MM/DD
                    time: 'All Day',
                    author: 'System',
                    isEntireFamily: true,
                    householdId: 'all'
                 });
              }
           }
        }
     });
     
     // Optionally sort list by day here
     return list;
  }, [events, users]);

  const currentPosts = posts.filter(p => p.scope === activeScope);

  const pickMedia = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.7,
    });

    if (!result.canceled) {
      if (!isPosting) setIsPosting(true);
      const isVideo = result.assets[0].type === 'video' || result.assets[0].uri.endsWith('.mp4') || result.assets[0].uri.endsWith('.mov');
      setSelectedMedia({ uri: result.assets[0].uri, type: isVideo ? 'video' : 'image' });
    }
  };

  const submitPost = async () => {
    if (!newPostText.trim() && !selectedMedia) {
        setIsPosting(false);
        return;
    }
    
    setUploading(true);
    try {
      let downloadUrl = '';
      if (selectedMedia) {
         try {
           const response = await fetch(selectedMedia.uri);
           const blob = await response.blob();
           const ext = selectedMedia.type === 'video' ? 'mp4' : 'jpg';
           const fileRef = ref(storage, `feed/${auth.currentUser?.uid}-${Date.now()}.${ext}`);
           await uploadBytes(fileRef, blob);
           downloadUrl = await getDownloadURL(fileRef);
         } catch(e) {
           console.log("Storage upload failed, attempting without media:", e);
           // Fallback will just post without media if storage rules block
           alert("Could not upload media. Check Firebase Storage rules.");
         }
      }

      await addDoc(collection(db, 'family_feed'), {
        author: auth.currentUser?.displayName || 'Family Member',
        authorId: auth.currentUser?.uid || '',
        text: newPostText.trim(),
        scope: activeScope,
        mediaUrl: downloadUrl || null,
        mediaType: selectedMedia?.type || null,
        likes: [],
        createdAt: serverTimestamp()
      });
      setNewPostText('');
      setSelectedMedia(null);
      setIsPosting(false);
    } catch (e: any) { 
        alert("Failed to post: " + e.message); 
    } finally {
        setUploading(false);
    }
  };

  const toggleLike = async (postId: string, currentLikes: string[]) => {
      if (!auth.currentUser) return;
      const uid = auth.currentUser.uid;
      const isLiked = currentLikes.includes(uid);
      const postRef = doc(db, 'family_feed', postId);
      try {
         await updateDoc(postRef, {
             likes: isLiked ? arrayRemove(uid) : arrayUnion(uid)
         });
      } catch(e) {}
  };

  const submitComment = async (postId: string) => {
      if (!commentText.trim() || !auth.currentUser) return;
      const postRef = doc(db, 'family_feed', postId);
      try {
         await updateDoc(postRef, {
             comments: arrayUnion({
                id: Date.now().toString(),
                author: auth.currentUser.displayName || 'Family Member',
                text: commentText.trim(),
                createdAt: new Date().toISOString()
             })
         });
         setCommentText('');
         setCommentingOn(null);
      } catch(e) {}
  };

  const blurTint: BlurTint = isDark ? 'dark' : 'light';

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={isDark ? ['#1a1a2e', '#16213e', '#0f3460'] : ['#e0c3fc', '#8ec5fc', '#4facfe']} style={styles.safeArea}>
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

          {/* HEADER */}
          <BlurView intensity={isDark ? 50 : 80} tint={blurTint} style={styles.headerGlass}>
            <View style={styles.headerContent}>
              <Text style={styles.title}>Johnson Family Hub</Text>
            </View>
          </BlurView>

          {/* POST FEED */}
          <ScrollView style={styles.feedContainer} contentContainerStyle={{padding: 16, paddingBottom: 100}}>

            {/* UPCOMING GLOBAL EVENTS */}
            <View style={{marginBottom: 24}}>
               <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4}}>
                   <Text style={{fontSize: 18, fontWeight: '700', color: '#fff'}}>Upcoming Events</Text>
                   <TouchableOpacity onPress={() => router.push('/modal')} style={{backgroundColor: 'rgba(0,122,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12}}>
                       <Text style={{color: '#007aff', fontWeight: 'bold'}}>Add</Text>
                   </TouchableOpacity>
               </View>
               <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingRight: 16}}>
                  {globalEvents.length === 0 ? (
                      <BlurView intensity={isDark ? 40 : 80} tint={blurTint} style={{padding: 20, borderRadius: 20, minWidth: 250, alignItems: 'center', justifyContent: 'center'}}>
                          <Text style={{color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontStyle: 'italic'}}>No global family events coming up.</Text>
                      </BlurView>
                  ) : (
                      globalEvents.map(evt => {
                          const dayShort = evt.date.substring(0, 3).toUpperCase() || 'TBD';
                          const numDay = evt.date.replace(/[^0-9]/g, '').substring(0, 2) || '--';
                          return (
                              <BlurView key={evt.id} intensity={isDark ? 50 : 80} tint={blurTint} style={{flexDirection: 'row', width: 280, padding: 12, borderRadius: 20, marginRight: 12}}>
                                  <View style={{width: 50, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', marginRight: 12}}>
                                     <Text style={{fontSize: 12, fontWeight: '700', color: '#007aff'}}>{dayShort}</Text>
                                     <Text style={{fontSize: 22, fontWeight: '800', color: isDark ? '#fff' : '#000'}}>{numDay}</Text>
                                  </View>
                                  <View style={{flex: 1, justifyContent: 'center'}}>
                                     <Text style={{fontSize: 16, fontWeight: '700', color: isDark ? '#fff' : '#000', marginBottom: 2}} numberOfLines={1}>{evt.title}</Text>
                                     <Text style={{fontSize: 13, color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'}}>{evt.time}</Text>
                                  </View>
                              </BlurView>
                          )
                      })
                  )}
               </ScrollView>
            </View>

            {/* Create Post Action Area */}
            {isPosting ? (
              <BlurView intensity={isDark ? 50 : 80} tint={blurTint} style={styles.composeCard}>
                 <TextInput
                   style={styles.postInput}
                   placeholder="Share something with the family..."
                   placeholderTextColor={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}
                   value={newPostText}
                   onChangeText={setNewPostText}
                   multiline
                 />
                 
                 {selectedMedia && (
                    <View style={styles.mediaPreviewContainer}>
                       {selectedMedia.type === 'video' ? (
                          <View style={styles.videoPlaceholder}>
                             <IconSymbol name="play.circle.fill" size={32} color="#fff" />
                             <Text style={{color: '#fff', marginTop: 8}}>Video Attached</Text>
                          </View>
                       ) : (
                          <Image source={{uri: selectedMedia.uri}} style={styles.imagePreview} />
                       )}
                       <TouchableOpacity style={styles.mediaCancelBtn} onPress={() => setSelectedMedia(null)}>
                           <IconSymbol name="xmark.circle.fill" size={24} color="#fff" />
                       </TouchableOpacity>
                    </View>
                 )}

                 <View style={styles.composeActions}>
                    <TouchableOpacity style={styles.attachBtn} onPress={pickMedia}>
                       <IconSymbol name="photo.fill" size={24} color={isDark ? "#fff" : "#000"} />
                       <Text style={styles.attachBtnText}>Photo/Video</Text>
                    </TouchableOpacity>
                    
                    <View style={{flexDirection: 'row'}}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => { setIsPosting(false); setSelectedMedia(null); setNewPostText(''); }} disabled={uploading}>
                           <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.submitBtn, uploading && {opacity: 0.6}]} onPress={submitPost} disabled={uploading}>
                           {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Post</Text>}
                        </TouchableOpacity>
                    </View>
                 </View>
              </BlurView>
            ) : (
              <TouchableOpacity style={styles.createPostTrigger} onPress={() => setIsPosting(true)}>
                 <BlurView intensity={isDark ? 50 : 80} tint={blurTint} style={styles.triggerCard}>
                    <LinearGradient colors={['#FF5F6D', '#FFC371']} style={[styles.profileInitialsBox, {borderWidth: 0}]}>
                        <Text style={[styles.profileInitials, {color: '#fff'}]}>{(auth.currentUser?.displayName || 'U').charAt(0).toUpperCase()}</Text>
                    </LinearGradient>
                    <Text style={styles.triggerText}>Share a photo, video, or update...</Text>
                 </BlurView>
              </TouchableOpacity>
            )}

            {/* Render Posts */}
            {currentPosts.length === 0 ? (
               <View style={styles.emptyState}>
                 <IconSymbol name="photo.on.rectangle.angled" size={64} color={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"} />
                 <Text style={styles.emptyText}>No posts yet. Be the first to share!</Text>
               </View>
            ) : (
               currentPosts.map(post => {
                  const hasLiked = !!auth.currentUser && post.likes?.includes(auth.currentUser.uid);
                  return (
                      <BlurView key={post.id} intensity={isDark ? 50 : 80} tint={blurTint} style={styles.postCard}>
                         <View style={styles.postHeader}>
                            <LinearGradient colors={['#FF512F', '#F09819']} style={styles.postAuthorBadge}>
                                <Text style={[styles.profileInitials, {color: '#fff', fontSize: 18}]}>{post.author.charAt(0).toUpperCase()}</Text>
                            </LinearGradient>
                            <View style={{flex: 1}}>
                                <Text style={styles.postAuthorName}>{post.author}</Text>
                                <Text style={styles.postTimeText}>{post.time}</Text>
                            </View>
                         </View>
                         
                         {post.text ? <Text style={styles.postText}>{post.text}</Text> : null}
                         
                         {post.mediaUrl && (
                             <View style={styles.postMediaBox}>
                                {post.mediaType === 'video' ? (
                                    <Video
                                      source={{ uri: post.mediaUrl }}
                                      style={styles.postImage}
                                      useNativeControls
                                      resizeMode={ResizeMode.COVER}
                                      isLooping
                                    />
                                ) : (
                                    <Image source={{ uri: post.mediaUrl }} style={styles.postImage} />
                                )}
                             </View>
                         )}
                         
                         <View style={styles.postFooter}>
                            <TouchableOpacity style={styles.likeBtn} onPress={() => toggleLike(post.id, post.likes)}>
                               <IconSymbol name={hasLiked ? "heart.fill" : "heart"} size={22} color={hasLiked ? "#ff3b30" : (isDark ? "#aeaeb2" : "#8e8e93")} />
                               <Text style={[styles.likeText, hasLiked && {color: "#ff3b30"}]}>
                                  {post.likes?.length || 0}
                               </Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.likeBtn} onPress={() => {
                                setCommentingOn(commentingOn === post.id ? null : post.id);
                                setCommentText('');
                            }}>
                               <IconSymbol name="bubble.right" size={20} color={isDark ? "#aeaeb2" : "#8e8e93"} />
                               <Text style={styles.likeText}>
                                  {post.comments?.length || 0}
                               </Text>
                            </TouchableOpacity>
                         </View>

                         {/* Comments Section */}
                         {(post.comments?.length || 0) > 0 || commentingOn === post.id ? (
                            <View style={styles.commentsSection}>
                               {post.comments?.map((c: any) => (
                                  <View key={c.id} style={styles.commentRow}>
                                     <Text style={styles.commentAuthor}>{c.author}</Text>
                                     <Text style={styles.commentText}>{c.text}</Text>
                                  </View>
                               ))}
                               {commentingOn === post.id && (
                                  <View style={styles.commentInputRow}>
                                     <TextInput 
                                        style={styles.commentInput}
                                        placeholder="Write a comment..."
                                        placeholderTextColor={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}
                                        value={commentText}
                                        onChangeText={setCommentText}
                                        autoFocus
                                        onSubmitEditing={() => submitComment(post.id)}
                                     />
                                     <TouchableOpacity onPress={() => submitComment(post.id)} style={styles.sendCommentBtn}>
                                        <IconSymbol name="arrow.up.circle.fill" size={28} color="#007aff" />
                                     </TouchableOpacity>
                                  </View>
                               )}
                            </View>
                         ) : null}
                      </BlurView>
                  )
               })
            )}

          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerGlass: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  segmentContainer: {
    flexDirection: 'row',
    marginTop: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)',
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: isDark ? '#aeaeb2' : '#8e8e93',
  },
  segmentTextActive: {
    color: isDark ? '#fff' : '#000',
  },
  feedContainer: {
    flex: 1,
  },
  createPostTrigger: {
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  triggerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  },
  profileInitialsBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,122,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileInitials: {
    color: isDark ? '#fff' : '#007aff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  triggerText: {
    fontSize: 16,
    color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
  },
  composeCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  postInput: {
    color: isDark ? '#fff' : '#000',
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  mediaPreviewContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  videoPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCancelBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
  },
  composeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    paddingTop: 12,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  attachBtnText: {
    marginLeft: 6,
    color: isDark ? '#fff' : '#000',
    fontWeight: '600',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: isDark ? '#aeaeb2' : '#8e8e93',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#007aff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  postCard: {
    borderRadius: 32,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  postAuthorBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,122,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  postAuthorName: {
    fontSize: 17,
    fontWeight: '700',
    color: isDark ? '#fff' : '#000',
  },
  postTimeText: {
    fontSize: 13,
    color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
    marginTop: 2,
  },
  postText: {
    fontSize: 16,
    lineHeight: 22,
    color: isDark ? '#fff' : '#1c1c1e',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  postMediaBox: {
    width: '100%',
    aspectRatio: 4/3,
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  postFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  likeText: {
    color: isDark ? '#aeaeb2' : '#8e8e93',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
    fontSize: 16,
    marginTop: 16,
  },
  commentsSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  commentAuthor: {
    fontWeight: 'bold',
    color: isDark ? '#fff' : '#000',
    marginRight: 6,
  },
  commentText: {
    flex: 1,
    color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)',
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  commentInput: {
    flex: 1,
    color: isDark ? '#fff' : '#000',
    paddingVertical: 10,
    fontSize: 15,
  },
  sendCommentBtn: {
    marginLeft: 8,
  }
});
