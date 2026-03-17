export interface ScannedMovie {
  id: string;
  filePath: string;
  fileName: string;
  folderPath: string;
  folderName: string;
  parsedTitle: string;
  parsedYear: number | null;
  hasNfo: boolean;
  hasPoster: boolean;
  hasFanart: boolean;
  nfoPath: string | null;
  posterPath: string | null;
  fanartPath: string | null;
  posterTs: number | null;
  fanartTs: number | null;
  matched: boolean;
  ignored: boolean;
  tmdbId: number | null;
  imdbId: string | null;
  movieData: MovieData | null;
  parts: MoviePart[];
}

export interface MoviePart {
  partNum: number;
  filePath: string;
  fileName: string;
}

export interface MovieData {
  title: string;
  originalTitle: string;
  sortTitle: string;
  set: string;
  rating: number;
  year: number;
  votes: number;
  outline: string;
  plot: string;
  tagline: string;
  runtime: number;
  mpaa: string;
  imdbId: string;
  tmdbId: number;
  trailer: string;
  genres: string[];
  directors: string[];
  writers: string[];
  studios: string[];
  countries: string[];
  actors: ActorData[];
  posterUrl: string;
  fanartUrl: string;
  thumbUrl: string;
}

export interface ActorData {
  name: string;
  role: string;
  thumb: string;
  order: number;
}

export interface TmdbSearchResult {
  id: number;
  title: string;
  originalTitle: string;
  year: number;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number;
  voteCount: number;
  releaseDate: string;
}

export interface AppSettings {
  movieDirectories: string[];
  namingConvention: "folder" | "filename";
  downloadPoster: boolean;
  downloadFanart: boolean;
  downloadActorThumbs: boolean;
  autoSaveNfo: boolean;
  autoSaveImages: boolean;
  language: string;
  cleanupStrings: string[];
}
