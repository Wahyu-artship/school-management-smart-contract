const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SchoolManagement", function () {
  let schoolManagement;
  let admin;
  let teacher1;
  let teacher2;
  let student1;
  let student2;

  beforeEach(async function () {
    // Get signers
    [admin, teacher1, teacher2, student1, student2] = await ethers.getSigners();

    // Deploy contract
    const SchoolManagement = await ethers.getContractFactory("SchoolManagement");
    schoolManagement = await SchoolManagement.deploy();
    await schoolManagement.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right admin", async function () {
      expect(await schoolManagement.admin()).to.equal(admin.address);
    });

    it("Should initialize counters to zero", async function () {
      expect(await schoolManagement.studentCounter()).to.equal(0);
      expect(await schoolManagement.courseCounter()).to.equal(0);
      expect(await schoolManagement.gradeCounter()).to.equal(0);
    });
  });

  describe("Teacher Management", function () {
    it("Should allow admin to add teacher", async function () {
      await expect(schoolManagement.connect(admin).addTeacher(teacher1.address))
        .to.emit(schoolManagement, "TeacherAdded")
        .withArgs(teacher1.address, await ethers.provider.getBlock('latest').then(b => b.timestamp + 1));

      expect(await schoolManagement.teachers(teacher1.address)).to.equal(true);
    });

    it("Should not allow non-admin to add teacher", async function () {
      await expect(
        schoolManagement.connect(teacher1).addTeacher(teacher2.address)
      ).to.be.revertedWith("Only admin can perform this action");
    });

    it("Should not allow adding same teacher twice", async function () {
      await schoolManagement.connect(admin).addTeacher(teacher1.address);
      
      await expect(
        schoolManagement.connect(admin).addTeacher(teacher1.address)
      ).to.be.revertedWith("Teacher already exists");
    });

    it("Should allow admin to remove teacher", async function () {
      await schoolManagement.connect(admin).addTeacher(teacher1.address);
      
      await expect(schoolManagement.connect(admin).removeTeacher(teacher1.address))
        .to.emit(schoolManagement, "TeacherRemoved");

      expect(await schoolManagement.teachers(teacher1.address)).to.equal(false);
    });
  });

  describe("Student Registration", function () {
    it("Should register a student successfully", async function () {
      await expect(schoolManagement.connect(admin).registerStudent("Ahmad", 15))
        .to.emit(schoolManagement, "StudentRegistered")
        .withArgs(1, "Ahmad", await ethers.provider.getBlock('latest').then(b => b.timestamp + 1));

      expect(await schoolManagement.studentCounter()).to.equal(1);
      
      const student = await schoolManagement.getStudent(1);
      expect(student[1]).to.equal("Ahmad"); // name
      expect(student[2]).to.equal(15); // age
      expect(student[3]).to.equal(true); // isEnrolled
    });

    it("Should not allow empty name", async function () {
      await expect(
        schoolManagement.connect(admin).registerStudent("", 15)
      ).to.be.revertedWith("Name cannot be empty");
    });

    it("Should not allow invalid age", async function () {
      await expect(
        schoolManagement.connect(admin).registerStudent("Ahmad", 3)
      ).to.be.revertedWith("Invalid age");

      await expect(
        schoolManagement.connect(admin).registerStudent("Ahmad", 101)
      ).to.be.revertedWith("Invalid age");
    });

    it("Should not allow non-admin to register student", async function () {
      await expect(
        schoolManagement.connect(teacher1).registerStudent("Ahmad", 15)
      ).to.be.revertedWith("Only admin can perform this action");
    });

    it("Should register multiple students", async function () {
      await schoolManagement.connect(admin).registerStudent("Ahmad", 15);
      await schoolManagement.connect(admin).registerStudent("Fatimah", 16);
      await schoolManagement.connect(admin).registerStudent("Ali", 14);

      expect(await schoolManagement.getTotalStudents()).to.equal(3);
    });
  });

  describe("Course Management", function () {
    beforeEach(async function () {
      await schoolManagement.connect(admin).addTeacher(teacher1.address);
    });

    it("Should create a course successfully", async function () {
      await expect(
        schoolManagement.connect(admin).createCourse(
          "Mathematics",
          "Advanced Math Course",
          teacher1.address,
          30
        )
      )
        .to.emit(schoolManagement, "CourseCreated")
        .withArgs(1, "Mathematics", teacher1.address);

      expect(await schoolManagement.courseCounter()).to.equal(1);

      const course = await schoolManagement.getCourse(1);
      expect(course[1]).to.equal("Mathematics"); // name
      expect(course[3]).to.equal(teacher1.address); // teacher
      expect(course[4]).to.equal(30); // capacity
    });

    it("Should not allow empty course name", async function () {
      await expect(
        schoolManagement.connect(admin).createCourse("", "Description", teacher1.address, 30)
      ).to.be.revertedWith("Course name cannot be empty");
    });

    it("Should not allow zero capacity", async function () {
      await expect(
        schoolManagement.connect(admin).createCourse("Math", "Description", teacher1.address, 0)
      ).to.be.revertedWith("Capacity must be greater than 0");
    });

    it("Should not allow invalid teacher", async function () {
      await expect(
        schoolManagement.connect(admin).createCourse("Math", "Description", student1.address, 30)
      ).to.be.revertedWith("Invalid teacher address");
    });
  });

  describe("Course Enrollment", function () {
    let studentId;
    let courseId;

    beforeEach(async function () {
      await schoolManagement.connect(admin).addTeacher(teacher1.address);
      studentId = 1;
      courseId = 1;
      
      await schoolManagement.connect(admin).registerStudent("Ahmad", 15);
      await schoolManagement.connect(admin).createCourse(
        "Mathematics",
        "Advanced Math Course",
        teacher1.address,
        2
      );
    });

    it("Should enroll student in course", async function () {
      await expect(
        schoolManagement.connect(admin).enrollStudentInCourse(studentId, courseId)
      )
        .to.emit(schoolManagement, "StudentEnrolledInCourse")
        .withArgs(studentId, courseId, await ethers.provider.getBlock('latest').then(b => b.timestamp + 1));

      expect(await schoolManagement.isStudentEnrolledInCourse(studentId, courseId)).to.equal(true);
      
      const course = await schoolManagement.getCourse(courseId);
      expect(course[5]).to.equal(1); // enrolled count
    });

    it("Should not allow duplicate enrollment", async function () {
      await schoolManagement.connect(admin).enrollStudentInCourse(studentId, courseId);
      
      await expect(
        schoolManagement.connect(admin).enrollStudentInCourse(studentId, courseId)
      ).to.be.revertedWith("Student already enrolled in this course");
    });

    it("Should not allow enrollment when course is full", async function () {
      await schoolManagement.connect(admin).registerStudent("Fatimah", 16);
      await schoolManagement.connect(admin).registerStudent("Ali", 14);
      
      await schoolManagement.connect(admin).enrollStudentInCourse(1, courseId);
      await schoolManagement.connect(admin).enrollStudentInCourse(2, courseId);
      
      await expect(
        schoolManagement.connect(admin).enrollStudentInCourse(3, courseId)
      ).to.be.revertedWith("Course is full");
    });
  });

  describe("Grade Management", function () {
    let studentId;
    let courseId;

    beforeEach(async function () {
      await schoolManagement.connect(admin).addTeacher(teacher1.address);
      
      await schoolManagement.connect(admin).registerStudent("Ahmad", 15);
      await schoolManagement.connect(admin).createCourse(
        "Mathematics",
        "Advanced Math Course",
        teacher1.address,
        30
      );
      
      studentId = 1;
      courseId = 1;
      
      await schoolManagement.connect(admin).enrollStudentInCourse(studentId, courseId);
    });

    it("Should allow teacher to assign grade", async function () {
      await expect(
        schoolManagement.connect(teacher1).assignGrade(studentId, courseId, 85, "Good work!")
      )
        .to.emit(schoolManagement, "GradeAssigned")
        .withArgs(studentId, courseId, 85, await ethers.provider.getBlock('latest').then(b => b.timestamp + 1));

      expect(await schoolManagement.gradeCounter()).to.equal(1);
    });

    it("Should retrieve grade correctly", async function () {
      await schoolManagement.connect(teacher1).assignGrade(studentId, courseId, 85, "Good work!");
      
      const grade = await schoolManagement.getStudentGradeForCourse(studentId, courseId);
      expect(grade[0]).to.equal(85); // score
      expect(grade[1]).to.equal("Good work!"); // remarks
    });

    it("Should not allow grade above 100", async function () {
      await expect(
        schoolManagement.connect(teacher1).assignGrade(studentId, courseId, 101, "Too high!")
      ).to.be.revertedWith("Score must be between 0 and 100");
    });

    it("Should not allow non-course teacher to assign grade", async function () {
      await schoolManagement.connect(admin).addTeacher(teacher2.address);
      
      await expect(
        schoolManagement.connect(teacher2).assignGrade(studentId, courseId, 85, "Good work!")
      ).to.be.revertedWith("Only course teacher can assign grades");
    });

    it("Should allow admin to assign grade", async function () {
      await expect(
        schoolManagement.connect(admin).assignGrade(studentId, courseId, 90, "Excellent!")
      ).to.emit(schoolManagement, "GradeAssigned");
    });

    it("Should not allow grade for unenrolled student", async function () {
      await schoolManagement.connect(admin).registerStudent("Fatimah", 16);
      
      await expect(
        schoolManagement.connect(teacher1).assignGrade(2, courseId, 85, "Good work!")
      ).to.be.revertedWith("Student not enrolled in this course");
    });
  });

  describe("Utility Functions", function () {
    beforeEach(async function () {
      await schoolManagement.connect(admin).addTeacher(teacher1.address);
      await schoolManagement.connect(admin).registerStudent("Ahmad", 15);
      await schoolManagement.connect(admin).createCourse("Math", "Math course", teacher1.address, 30);
      await schoolManagement.connect(admin).createCourse("Science", "Science course", teacher1.address, 30);
    });

    it("Should return correct student course count", async function () {
      await schoolManagement.connect(admin).enrollStudentInCourse(1, 1);
      await schoolManagement.connect(admin).enrollStudentInCourse(1, 2);
      
      expect(await schoolManagement.getStudentCourseCount(1)).to.equal(2);
    });

    it("Should return correct total counts", async function () {
      await schoolManagement.connect(admin).registerStudent("Fatimah", 16);
      
      expect(await schoolManagement.getTotalStudents()).to.equal(2);
      expect(await schoolManagement.getTotalCourses()).to.equal(2);
    });
  });
});
