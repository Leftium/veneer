// Shared playlist regexes — column header detection
// Required (both must match for playlist detection):
export const REGEX_PLAYLIST_TITLE = /title|제목|곡명|song|track/i
export const REGEX_PLAYLIST_ARTIST = /artist|아티스트|가수|singer/i

// Optional columns (enhance playlist display):
export const REGEX_PLAYLIST_LENGTH = /length|duration|시간|길이/i
export const REGEX_PLAYLIST_BPM = /bpm|tempo|빠르기/i
export const REGEX_PLAYLIST_GENRE = /genre|장르/i
export const REGEX_PLAYLIST_YEAR = /year|연도|년도/i
export const REGEX_PLAYLIST_ALBUM = /album|앨범/i
export const REGEX_PLAYLIST_REMIX = /remix|리믹스|version|버전/i
export const REGEX_PLAYLIST_PLAYTIME = /play.?time|재생.?시간|played/i
