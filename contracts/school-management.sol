// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SchoolManagement
 * @dev Sistem manajemen sekolah berbasis blockchain
 * @author Wahyu
 */
contract SchoolManagement {
    
    // Structs
    struct Student {
        uint256 id;
        string name;
        uint256 age;
        bool isEnrolled;
        uint256 enrollmentDate;
        uint256[] courseIds;
    }
    
    struct Course {
        uint256 id;
        string name;
        string description;
        address teacher;
        uint256 capacity;
        uint256 enrolled;
        bool isActive;
    }
    
    struct Grade {
        uint256 studentId;
        uint256 courseId;
        uint256 score;
        string remarks;
        uint256 timestamp;
    }
    
    // State variables
    address public admin;
    uint256 public studentCounter;
    uint256 public courseCounter;
    uint256 public gradeCounter;
    
    // Mappings
    mapping(uint256 => Student) public students;
    mapping(uint256 => Course) public courses;
    mapping(uint256 => Grade) public grades;
    mapping(address => bool) public teachers;
    mapping(uint256 => mapping(uint256 => bool)) public studentInCourse; // studentId => courseId => enrolled
    mapping(uint256 => mapping(uint256 => uint256)) public studentGrades; // studentId => courseId => gradeId
    
    // Events
    event StudentRegistered(uint256 indexed studentId, string name, uint256 timestamp);
    event StudentEnrolledInCourse(uint256 indexed studentId, uint256 indexed courseId, uint256 timestamp);
    event CourseCreated(uint256 indexed courseId, string name, address teacher);
    event GradeAssigned(uint256 indexed studentId, uint256 indexed courseId, uint256 score, uint256 timestamp);
    event TeacherAdded(address indexed teacher, uint256 timestamp);
    event TeacherRemoved(address indexed teacher, uint256 timestamp);
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier onlyTeacher() {
        require(teachers[msg.sender] || msg.sender == admin, "Only teacher can perform this action");
        _;
    }
    
    modifier studentExists(uint256 _studentId) {
        require(_studentId > 0 && _studentId <= studentCounter, "Student does not exist");
        require(students[_studentId].isEnrolled, "Student is not enrolled");
        _;
    }
    
    modifier courseExists(uint256 _courseId) {
        require(_courseId > 0 && _courseId <= courseCounter, "Course does not exist");
        require(courses[_courseId].isActive, "Course is not active");
        _;
    }
    
    // Constructor
    constructor() {
        admin = msg.sender;
    }
    
    // Admin Functions
    function addTeacher(address _teacher) external onlyAdmin {
        require(_teacher != address(0), "Invalid teacher address");
        require(!teachers[_teacher], "Teacher already exists");
        
        teachers[_teacher] = true;
        emit TeacherAdded(_teacher, block.timestamp);
    }
    
    function removeTeacher(address _teacher) external onlyAdmin {
        require(teachers[_teacher], "Teacher does not exist");
        
        teachers[_teacher] = false;
        emit TeacherRemoved(_teacher, block.timestamp);
    }
    
    // Student Functions
    function registerStudent(string memory _name, uint256 _age) external onlyAdmin returns (uint256) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_age >= 5 && _age <= 100, "Invalid age");
        
        studentCounter++;
        
        Student storage newStudent = students[studentCounter];
        newStudent.id = studentCounter;
        newStudent.name = _name;
        newStudent.age = _age;
        newStudent.isEnrolled = true;
        newStudent.enrollmentDate = block.timestamp;
        
        emit StudentRegistered(studentCounter, _name, block.timestamp);
        return studentCounter;
    }
    
    function getStudent(uint256 _studentId) external view studentExists(_studentId) 
        returns (uint256, string memory, uint256, bool, uint256, uint256[] memory) {
        Student memory student = students[_studentId];
        return (
            student.id,
            student.name,
            student.age,
            student.isEnrolled,
            student.enrollmentDate,
            student.courseIds
        );
    }
    
    // Course Functions
    function createCourse(
        string memory _name,
        string memory _description,
        address _teacher,
        uint256 _capacity
    ) external onlyAdmin returns (uint256) {
        require(bytes(_name).length > 0, "Course name cannot be empty");
        require(_capacity > 0, "Capacity must be greater than 0");
        require(teachers[_teacher] || _teacher == admin, "Invalid teacher address");
        
        courseCounter++;
        
        Course storage newCourse = courses[courseCounter];
        newCourse.id = courseCounter;
        newCourse.name = _name;
        newCourse.description = _description;
        newCourse.teacher = _teacher;
        newCourse.capacity = _capacity;
        newCourse.enrolled = 0;
        newCourse.isActive = true;
        
        emit CourseCreated(courseCounter, _name, _teacher);
        return courseCounter;
    }
    
    function enrollStudentInCourse(uint256 _studentId, uint256 _courseId) 
        external 
        onlyAdmin 
        studentExists(_studentId) 
        courseExists(_courseId) {
        
        require(!studentInCourse[_studentId][_courseId], "Student already enrolled in this course");
        
        Course storage course = courses[_courseId];
        require(course.enrolled < course.capacity, "Course is full");
        
        studentInCourse[_studentId][_courseId] = true;
        course.enrolled++;
        students[_studentId].courseIds.push(_courseId);
        
        emit StudentEnrolledInCourse(_studentId, _courseId, block.timestamp);
    }
    
    function getCourse(uint256 _courseId) external view courseExists(_courseId)
        returns (uint256, string memory, string memory, address, uint256, uint256, bool) {
        Course memory course = courses[_courseId];
        return (
            course.id,
            course.name,
            course.description,
            course.teacher,
            course.capacity,
            course.enrolled,
            course.isActive
        );
    }
    
    // Grade Functions
    function assignGrade(
        uint256 _studentId,
        uint256 _courseId,
        uint256 _score,
        string memory _remarks
    ) external onlyTeacher studentExists(_studentId) courseExists(_courseId) {
        require(studentInCourse[_studentId][_courseId], "Student not enrolled in this course");
        require(_score <= 100, "Score must be between 0 and 100");
        require(
            courses[_courseId].teacher == msg.sender || msg.sender == admin,
            "Only course teacher can assign grades"
        );
        
        gradeCounter++;
        
        Grade storage newGrade = grades[gradeCounter];
        newGrade.studentId = _studentId;
        newGrade.courseId = _courseId;
        newGrade.score = _score;
        newGrade.remarks = _remarks;
        newGrade.timestamp = block.timestamp;
        
        studentGrades[_studentId][_courseId] = gradeCounter;
        
        emit GradeAssigned(_studentId, _courseId, _score, block.timestamp);
    }
    
    function getGrade(uint256 _gradeId) external view returns (uint256, uint256, uint256, string memory, uint256) {
        require(_gradeId > 0 && _gradeId <= gradeCounter, "Grade does not exist");
        Grade memory grade = grades[_gradeId];
        return (
            grade.studentId,
            grade.courseId,
            grade.score,
            grade.remarks,
            grade.timestamp
        );
    }
    
    function getStudentGradeForCourse(uint256 _studentId, uint256 _courseId) 
        external 
        view 
        returns (uint256, string memory, uint256) {
        require(studentInCourse[_studentId][_courseId], "Student not enrolled in this course");
        uint256 gradeId = studentGrades[_studentId][_courseId];
        require(gradeId > 0, "Grade not assigned yet");
        
        Grade memory grade = grades[gradeId];
        return (grade.score, grade.remarks, grade.timestamp);
    }
    
    // Utility Functions
    function getStudentCourseCount(uint256 _studentId) external view studentExists(_studentId) returns (uint256) {
        return students[_studentId].courseIds.length;
    }
    
    function isStudentEnrolledInCourse(uint256 _studentId, uint256 _courseId) external view returns (bool) {
        return studentInCourse[_studentId][_courseId];
    }
    
    function getTotalStudents() external view returns (uint256) {
        return studentCounter;
    }
    
    function getTotalCourses() external view returns (uint256) {
        return courseCounter;
    }
    
    function getTotalGrades() external view returns (uint256) {
        return gradeCounter;
    }
}
