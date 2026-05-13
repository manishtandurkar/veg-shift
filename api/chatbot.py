import os
import json
from typing import List, Dict
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

class VegShiftChatbot:
    def __init__(self):
        self.documents = []
        self.vectorizer = None
        self.tfidf_matrix = None
        self._load_knowledge_base()

    def _load_knowledge_base(self):
        """Load project documentation and key outputs into knowledge base"""
        docs_dir = os.path.join(os.path.dirname(__file__), '..', 'docs')
        data_output_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'output')

        # Load documentation files
        doc_files = [
            'explanation.md',
            'LAYMAN_GUIDE.md',
            'MENTOR_SUMMARY.md',
            'READING_ROADMAP.md',
            'instructions.md',
            'data_flow.md'
        ]

        for doc_file in doc_files:
            file_path = os.path.join(docs_dir, doc_file)
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        self.documents.append({
                            'content': content,
                            'source': f'docs/{doc_file}',
                            'type': 'documentation'
                        })
                except Exception as e:
                    print(f"Error loading {doc_file}: {e}")

        # Load key output files (JSON files that contain explanations)
        output_files = [
            'baseline_metrics.json',
            'crop_advisory.json',
            'crop_viability_events.json',
            'exploitation_risk_report.json',
            'irrigation_strategy.json',
            'shap_explanation.json',
            'transition_report.json',
            'viability_trend_report.json'
        ]

        for output_file in output_files:
            file_path = os.path.join(data_output_dir, output_file)
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        # Convert JSON to readable text
                        content = json.dumps(data, indent=2)
                        self.documents.append({
                            'content': content,
                            'source': f'output/{output_file}',
                            'type': 'output_data'
                        })
                except Exception as e:
                    print(f"Error loading {output_file}: {e}")

        # Build TF-IDF vectors
        if self.documents:
            self.vectorizer = TfidfVectorizer(stop_words='english', max_features=5000)
            contents = [doc['content'] for doc in self.documents]
            self.tfidf_matrix = self.vectorizer.fit_transform(contents)

    def _extract_relevant_sentences(self, content: str, query: str, max_sentences: int = 5) -> str:
        """Extract sentences most relevant to the query rather than just the first N."""
        query_terms = set(query.lower().split())
        # Split on sentence boundaries
        import re
        raw = re.split(r'(?<=[.!?])\s+', content)
        sentences = [s.strip() for s in raw if len(s.strip()) > 20]

        # Score each sentence by query term overlap
        scored = []
        for s in sentences:
            words = set(s.lower().split())
            score = len(query_terms & words)
            scored.append((score, s))

        scored.sort(key=lambda x: x[0], reverse=True)
        top = [s for _, s in scored[:max_sentences] if s]
        return ' '.join(top)

    def get_response(self, query: str, history: List[Dict[str, str]] | None = None) -> Dict[str, str]:
        """Get response to user query based on knowledge base."""
        if not self.documents or self.vectorizer is None:
            return {
                'response': "I don't have access to the knowledge base right now. Please try again later.",
                'source': 'system'
            }

        # Augment query with last user turn from history for context
        augmented_query = query
        if history:
            last_user = next((m['text'] for m in reversed(history) if m.get('isUser')), None)
            if last_user and last_user != query:
                augmented_query = f"{last_user} {query}"

        query_vector = self.vectorizer.transform([augmented_query])
        similarities = cosine_similarity(query_vector, self.tfidf_matrix)[0]

        top_indices = np.argsort(similarities)[-3:][::-1]
        top_docs = [self.documents[i] for i in top_indices if similarities[i] > 0.05]

        if not top_docs:
            return {
                'response': "I couldn't find specific information about that. Try asking about crop advisories, irrigation strategies, risk scores, SHAP explanations, or city-level climate data.",
                'source': 'system'
            }

        response_parts = []
        sources = []

        for doc in top_docs[:2]:
            relevant = self._extract_relevant_sentences(doc['content'], query, max_sentences=4)
            if relevant:
                response_parts.append(relevant)
            sources.append(doc['source'])

        response = ' '.join(response_parts)
        # Trim to a readable length
        if len(response) > 1200:
            response = response[:1197] + '…'

        return {
            'response': response,
            'source': ', '.join(dict.fromkeys(sources))
        }

# Global chatbot instance
chatbot = VegShiftChatbot()