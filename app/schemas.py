from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    created_at: datetime


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    is_pinned: bool = False
    tag_ids: list[int] = []


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = Field(default=None, min_length=1)
    is_pinned: bool | None = None
    tag_ids: list[int] | None = None


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    content: str
    is_pinned: bool
    created_at: datetime
    updated_at: datetime
    tags: list[TagOut] = []


class NoteStats(BaseModel):
    tag: str
    count: int